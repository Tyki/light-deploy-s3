# light-deploy-s3

This tool allow you to deploy single file/directories to S3 buckets

# How to use 


```
npm install --save-dev light-deploy-s3
```

You have to create a .env file at the root of your project and put the following
```
aws_access_key_id=MY_ACCESS_KEY
aws_secret_access_key=MY_SECRET_KEY
```
This way, you can use the deployment tool using different credentials for each of your projects

Then, you can deploy using the following command at the root of your project (using the tool in a local project) : 
```
$ node node_modules/light-deploy-s3/deploy --file=/path/to/file/or/dir --region=[BucketRegion] --bucket=[BucketName] --cwd=path/inside/bucket
```

Example 
```
$ node node_modules/light-deploy-s3/deploy --file=./dist/my.js --region=eu-west-1 --bucket=myBucketName --cwd=files/js/
```
The tool will upload the file 'my.js' inside the bucket 'myBucketName' and in the folder 'files/js'

# Parameters

#### Mandatory parameters
`file` - Path to the file or directory to upload
`region` - Region of the bucket
`bucket` - Name of the bucket
`cwd` - Path used inside the bucket 

#### Optional parameters
`ACL` - Must be one of the [allowed ACL from AWS](https://docs.aws.amazon.com/AmazonS3/latest/dev/acl-overview.html#canned-acl). Default `'public-read'`