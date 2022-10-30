用于将Gitee中的仓库映射为Webdav

**文件的存储方式为分块存储，与原始Gitee文件存储结果不同。**

# 配置

## 文件系统配置

```json
{
	"mountPoint": "/Joplin",
	"users": [{
		"username": "admin",
		"password": "admin",
        "path":null,
        "rights":[]
	}]
}
```

将以上内容存储到```Gitee```仓库中```/configure```文件中。

参数```path```存储用户可以访问的目录。

参数```rights```存储用户的权限，默认为```["all"]```，可选值为：```'canWrite' | 'canWriteLocks' | 'canWriteContent' | 'canWriteContentTranslated' | 'canWriteContentSource' | 'canWriteProperties' | 'canRead' | 'canReadLocks' | 'canReadContent' | 'canReadContentTranslated' | 'canReadContentSource' | 'canReadProperties'```

## Gitee访问配置

通过环境变量进行配置

```javascript
{
    "GITEE_ACCESSTOKEN":process.env["GITEE_ACCESSTOKEN"]||"",
    "GITEE_OWNER":process.env["GITEE_OWNER"]||"",
    "GITEE_REPO":process.env["GITEE_REPO"]||"",
    "GITEE_BRANCH":process.env["GITEE_BRANCH"]||"",
    "WEBPORT":process.env["WEBPORT"]||3000
}
```


**修改配置后需要重新启动服务。**