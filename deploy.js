var s3 = require('s3')
var fs = require('fs')
var path = require('path')
var argv = require('minimist')(process.argv.slice(2))
var ora = require('ora')
var dotenv = require('dotenv')

var config = dotenv.config().parsed

if (!config.hasOwnProperty('aws_access_key_id')) {
    console.error('Missing "aws_access_key_id" in .env')
    process.exit(1)
}

if (!config.hasOwnProperty('aws_secret_access_key')) {
    console.error('Missing "aws_secret_access_key" in .env')
    process.exit(1)    
}

var accessKey = config.aws_access_key_id
var secretKey = config.aws_secret_access_key

var bucketName = ''
var bucketRegion = ''
var file = ''
var cwd = ''

var allParametersRequired = true
var mandatoryParameters = ['file', 'bucket', 'region', 'cwd']
mandatoryParameters.forEach(parameter => {
    if (!argv.hasOwnProperty(parameter)) {
        console.error(`Parameter ${parameter} is missing`)
        allParametersRequired = false
    }
})

if (!allParametersRequired) {
    console.log('Aborting script due to missing parameters')
    process.exit(1)
}

file = argv.file
bucketName = argv.bucket
bucketRegion = argv.region
cwd = argv.cwd

console.log(`Starting the deployment to S3 bucket : ${bucketName} (${bucketRegion})`)

var isDir = false
var fileName = ''
fs.open(file, 'r', (error, fd) => {
    if (error) {
        console.error('Error reading the file or directory')
        process.exit(1)
    }

    fs.fstat(fd, (error, stat) => {
        if (error) {
            console.error('Error reading stats of file or directory')
            process.exit(1)
        }

        isDir = stat.isDirectory()
        if (!isDir) {
            fileName = path.basename(file)
        }
        fs.close(fd, (error) => {
            if (error) {
                console.error('Error closing the file descriptor')
                process.exit(1)
            }

            startUpload()
        })
    })
})

/**
 * Upload file or directory content to specified bucket name and region
 */
function startUpload () {
    var client = s3.createClient({
        s3Options: {
            accessKeyId: accessKey,
            secretAccessKey: secretKey,
            region: bucketRegion
        }
    })

    var uploadParams = {
        s3Params: {
            Bucket: bucketName
        }
    }

    var spinner = ora('Start uploading')
    spinner.start()

    if (isDir) {
        uploadParams.localDir = file

        var uploader = client.uploadDir(uploadParams);
        uploader.on('error', function(err) {
            console.error("unable to sync:", err.stack)
        })
        uploader.on('end', function() {
            spinner.stop()
            console.log("Deployment done")
        })    
    } else {
        uploadParams.localFile = file
        uploadParams.s3Params.Key = cwd + fileName

        var uploader = client.uploadFile(uploadParams);
        uploader.on('error', function(err) {
            console.error("unable to download:", err.stack);
        })
        uploader.on('end', function() {
            spinner.stop()
            console.log("done downloading")
        })
    }
}
