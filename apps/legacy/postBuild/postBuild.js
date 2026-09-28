const fs = require('fs-extra');

const sourceYamlFilePath = './postBuild/app.yaml'
const destinationYamlFilePath = './gcpServer/app.yaml';
const destinationBuildPath= "./gcpServer/build"

fs.emptyDirSync(destinationBuildPath)

//copy over the yaml file into the root
// if (fs.existsSync(destinationYamlFilePath)) {
//     fs.unlinkSync(destinationYamlFilePath);
// }

//copy the build output into the gcp server folder 
fs.copySync('build', destinationBuildPath)
//copy the yaml file into the build folder
fs.copySync(sourceYamlFilePath, destinationYamlFilePath);
