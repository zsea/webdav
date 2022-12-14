/// <reference path="./snowflake.d.ts" />
import {
    LocalPropertyManager,
    LastModifiedDateInfo,
    FileSystemSerializer,
    OpenWriteStreamInfo,
    PropertyManagerInfo,
    OpenReadStreamInfo,
    IPropertyManager,
    LocalLockManager,
    CreationDateInfo,
    LockManagerInfo,
    SimpleCallback,
    ReturnCallback,
    ResourceType,
    ILockManager,
    ReadDirInfo,
    CreateInfo,
    DeleteInfo,
    FileSystem,
    SizeInfo,
    TypeInfo,
} from 'webdav-server/lib/manager/v2/fileSystem/export'
import { Readable, Writable } from 'stream'
import { RequestContext } from 'webdav-server/lib/server/v2/RequestContext'
import { startsWith } from 'webdav-server/lib/helper/JSCompatibility'
import { Errors } from 'webdav-server/lib/Errors'
import { Path } from 'webdav-server/lib/manager/v2/Path'
//import Snowflake from "@zsea/snowflake"
const Snowflake = require("@zsea/snowflake");
const snowflake = new Snowflake();

interface iNode {
    size: number,
    type: "file" | "dir",
    path: string,
    lastModifiedDate: number,
    creationDate: number,
    id: string,
    blockSize: number
}
export interface IZseaStorage {
    read(path: string): Promise<Buffer>
    save(path: string, buffer: Buffer): Promise<void>
    delete(path: string): Promise<void>
}
export class ZseaFileSystemResource {
    [key: string]: any
    props: LocalPropertyManager
    locks: LocalLockManager
    //content : Buffer[]
    size: number
    lastModifiedDate: number
    creationDate: number
    type: ResourceType
    id: string
    blockSize: number

    constructor(data: ZseaFileSystemResource | ResourceType, blockSize: number = 4096) {
        let rs: ZseaFileSystemResource;
        if (data && (data as ResourceType).isFile !== undefined && (data as ResourceType).isDirectory !== undefined) {
            rs = {
                type: data as ResourceType,
                id: snowflake.nextId().toString(),
                blockSize: blockSize
            } as ZseaFileSystemResource;
        }
        else {
            rs = data as ZseaFileSystemResource;
        }

        this.lastModifiedDate = rs.lastModifiedDate ? rs.lastModifiedDate : Date.now();
        this.creationDate = rs.creationDate ? rs.creationDate : Date.now();
        //this.content = rs.content ? rs.content.map((o) => Buffer.from(o)) : [];
        this.props = new LocalPropertyManager(rs.props);
        this.locks = new LocalLockManager();
        this.size = rs.size ? rs.size : 0;
        this.type = rs.type ? rs.type : ResourceType.File;
        this.id = rs.id;
        this.blockSize = rs.blockSize;
    }
    static updateLastModified(r: ZseaFileSystemResource) {
        r.lastModifiedDate = Date.now();
    }

}

export class ZseaFileReadable extends Readable {
    blockIndex: number

    constructor(public contents: any[][] | Buffer[] | Int8Array[]) {
        super();

        this.blockIndex = -1;
    }

    _read(size: number) {
        while (true) {
            ++this.blockIndex;

            if (this.blockIndex >= this.contents.length) {
                this.push(null);
                break;
            }

            if (!this.push(this.contents[this.blockIndex]))
                break;
        }
    }
}

export class ZseaFileWritable extends Writable {
    constructor(public storage:IZseaStorage,public id:string, public blockSize:number=4096){
        super(undefined);
    }
    private index:number=0;
    private buffer:Buffer=Buffer.alloc(0);
    private totalSize:number=0;
    //public tasks:Promise<void>[]=[];
    private save(callback:(error: Error) => void){
        let tasks:Promise<void>[]=[];
        while(this.buffer.length>=this.blockSize){
            let block=this.buffer.subarray(0,this.blockSize);
            
            tasks.push(this.storage.save(`/block.${this.id}.${this.index++}.bin`,block));
            this.buffer=this.buffer.subarray(this.blockSize);
        }
        return Promise.all(tasks).then(function(){
            callback(Errors.None);
        }).catch(function(){
            callback(Errors.InsufficientStorage);
        })
        
    }
    public saveAll(){
        return this.storage.save(`/block.${this.id}.${this.index++}.bin`,this.buffer);
    }
    public get size():number{
        return this.totalSize;
    }
    _write(chunk: Buffer | string | any, encoding: string, callback: (error: Error) => void) {
        this.totalSize=this.totalSize+chunk.length;
        this.buffer=Buffer.concat([this.buffer,chunk]);
        this.save(callback);
    }
}

export class ZseaSerializer implements FileSystemSerializer {
    uid(): string {
        return 'ZseaFSSerializer-1.0.0';
    }
    constructor(public storage: IZseaStorage, public blockSize: number = 4096) {

    }
    serialize(fs: ZseaFileSystem, callback: ReturnCallback<any>): void {
        callback(undefined, {
            resources: fs.resources
        });
    }

    unserialize(serializedData: any, callback: ReturnCallback<FileSystem>): void {
        // tslint:disable-next-line:no-use-before-declare
        const fs = new ZseaFileSystem(this.storage, this.blockSize);

        if (serializedData.resources) {
            for (const path in serializedData.resources)
                fs.resources[path] = new ZseaFileSystemResource(serializedData.resources[path]);
        }
        else {
            for (const path in serializedData)
                fs.resources[path] = new ZseaFileSystemResource(serializedData[path]);
        }

        callback(undefined, fs);
    }
}

// export const ZseaSerializerVersions = {
//     versions: {
//         '1.0.0': ZseaSerializer
//     },
//     instances: [
//         new ZseaSerializer()
//     ] as FileSystemSerializer[]
// }

export class ZseaFileSystem extends FileSystem {
    resources: {
        [path: string]: ZseaFileSystemResource
    }
    private storage: IZseaStorage
    private blockSize: number
    constructor(storage: IZseaStorage, blockSize: number = 4096, serializer?: FileSystemSerializer) {
        super(serializer ? serializer : new ZseaSerializer(storage, blockSize));
        this.storage = storage;
        this.blockSize = blockSize;
        this.resources = {
            '/': new ZseaFileSystemResource(ResourceType.Directory)
        };
    }
    private getINode(): string {
        let files: iNode[] = [];
        for (let path in this.resources) {
            files.push({
                size: this.resources[path].size,
                type: this.resources[path].type.isFile ? "file" : "dir",
                path: path,
                lastModifiedDate: this.resources[path].lastModifiedDate,
                creationDate: this.resources[path].creationDate,
                id: this.resources[path].id,
                blockSize: this.resources[path].blockSize
            })
        }
        return JSON.stringify(files);
    }
    Initialization(): Promise<void> {
        let self = this;
        return this.storage.read('/inode').then(function (buffer) {
            let content = buffer.toString("utf8");

            let files: iNode[] = JSON.parse(content);
            for (let i = 0; i < files.length; i++) {
                let item = files[i];
                self.resources[item.path] = new ZseaFileSystemResource({
                    size: item.size,
                    lastModifiedDate: item.lastModifiedDate,
                    creationDate: item.creationDate,
                    id: item.id,
                    type: item.type === "file" ? ResourceType.File : ResourceType.Directory,
                    blockSize: item.blockSize || self.blockSize
                } as ZseaFileSystemResource)
            }
        });
    }
    private saveINode(): Promise<void> {
        let inode = this.getINode();
        return this.storage.save("/inode", Buffer.from(inode))
    }

    protected _fastExistCheck(ctx: RequestContext, path: Path, callback: (exists: boolean) => void): void {
        callback(this.resources[path.toString()] !== undefined);
    }

    protected _create(path: Path, ctx: CreateInfo, callback: SimpleCallback): void {
        this.resources[path.toString()] = new ZseaFileSystemResource(ctx.type, this.blockSize);
        if (ctx.type === ResourceType.Directory) {
            this.saveINode().then(function(){
                callback();
            }).catch(function(){
                callback(Errors.InsufficientStorage);
            })
            return;
        }
        callback();
    }

    protected _delete(path: Path, ctx: DeleteInfo, callback: SimpleCallback): void {
        const sPath = path.toString(true);
        for (const path in this.resources) {
            if (startsWith(path, sPath))
                delete this.resources[path];
        }
        let file = this.resources[path.toString()];
        delete this.resources[path.toString()];

        this.saveINode().then(() => {
            let count = Math.ceil(file.size / file.blockSize);
            for (let i = 0; i < count; i++) {
                this.storage.delete(`/block.${file.id}.${i}.bin`).catch(function (e) {
                    //console.log(e);
                });
            }
            callback();
        }).catch(function(){
            callback(Errors.InsufficientStorage);
        })
        //let blocks: Promise<void>[] = [];

    }

    protected _openWriteStream(path: Path, ctx: OpenWriteStreamInfo, callback: ReturnCallback<Writable>): void {
        const resource = this.resources[path.toString()];
        if (resource === undefined)
            return callback(Errors.ResourceNotFound);

        const content: Buffer[] = [];
        const stream = new ZseaFileWritable(this.storage,resource.id,this.blockSize);
        //stream.on("")
        stream.on('finish', () => {
            stream.saveAll().then(()=>{
                resource.size=stream.size;
                ZseaFileSystemResource.updateLastModified(resource);
                return this.saveINode();
            }).catch((e: any)=>{
                let count = Math.ceil(resource.size / resource.blockSize);
                for (let i = 0; i < count; i++) {
                    this.storage.delete(`/block.${resource.id}.${i}.bin`);
                }
            });
        });
        callback(undefined, stream);
    }

    protected _openReadStream(path: Path, ctx: OpenReadStreamInfo, callback: ReturnCallback<Readable>): void {
        const resource = this.resources[path.toString()];
        if (resource === undefined)
            return callback(Errors.ResourceNotFound);

        let blocks: Promise<Buffer>[] = [];
        let count = Math.ceil(resource.size / resource.blockSize);
        for (let i = 0; i < count; i++) {
            blocks.push(this.storage.read(`/block.${resource.id}.${i}.bin`));
        }
        Promise.all(blocks).then(function (buffers) {

            callback(undefined, new ZseaFileReadable(buffers));
        }).catch(function (e) {
            return callback(Errors.ResourceNotFound);
        });

    }

    protected _size(path: Path, ctx: SizeInfo, callback: ReturnCallback<number>): void {
        this.getPropertyFromResource(path, ctx, 'size', callback);
    }

    protected _lockManager(path: Path, ctx: LockManagerInfo, callback: ReturnCallback<ILockManager>): void {
        this.getPropertyFromResource(path, ctx, 'locks', callback);
    }

    protected _propertyManager(path: Path, ctx: PropertyManagerInfo, callback: ReturnCallback<IPropertyManager>): void {
        this.getPropertyFromResource(path, ctx, 'props', callback);
    }

    protected _readDir(path: Path, ctx: ReadDirInfo, callback: ReturnCallback<string[] | Path[]>): void {
        const base = path.toString(true);
        const children = [];
        for (const subPath in this.resources) {
            if (startsWith(subPath, base)) {
                const pSubPath = new Path(subPath);
                if (pSubPath.paths.length === path.paths.length + 1)
                    children.push(pSubPath);
            }
        }

        callback(undefined, children);
    }

    /**
     * Get a property of an existing resource (object property, not WebDAV property). If the resource doesn't exist, it is created.
     * 
     * @param path Path of the resource
     * @param ctx Context of the method
     * @param propertyName Name of the property to get from the resource
     * @param callback Callback returning the property object of the resource
     */
    protected getPropertyFromResource(path: Path, ctx: TypeInfo, propertyName: string, callback: ReturnCallback<any>): void {
        const resource = this.resources[path.toString()];
        if (!resource)
            return callback(Errors.ResourceNotFound);

        callback(undefined, resource[propertyName]);
    }

    protected _creationDate(path: Path, ctx: CreationDateInfo, callback: ReturnCallback<number>): void {
        this.getPropertyFromResource(path, ctx, 'creationDate', callback);
    }

    protected _lastModifiedDate(path: Path, ctx: LastModifiedDateInfo, callback: ReturnCallback<number>): void {
        this.getPropertyFromResource(path, ctx, 'lastModifiedDate', callback);
    }

    protected _type(path: Path, ctx: TypeInfo, callback: ReturnCallback<ResourceType>): void {
        this.getPropertyFromResource(path, ctx, 'type', callback);
    }
}