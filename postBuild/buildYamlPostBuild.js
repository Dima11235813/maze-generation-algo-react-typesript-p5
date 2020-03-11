const fs = require('fs-extra');

// const buildYamlFilePath = './app.yaml';

// if (fs.existsSync(buildYamlFilePath)) {
//     fs.unlinkSync(buildYamlFilePath);
// }

//copy the build output into the gcp server folder 
fs.copySync('/build', '/gcpServer')
//copy the yaml file into the build folder
// fs.copySync('./postBuild/app.yaml', buildYamlFilePath);
