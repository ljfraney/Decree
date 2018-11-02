# Decree

An Azure DevOps extension for creating global policies

## What is it?

Decree is an extension that allows you to convert a branch policy to a global policy. It is enforced across
all repositories in your project. Your organization may have more than one project. This tool will only
apply policies to repositories in the same project.

### Development Prerequisites

* [Node.js](https://nodejs.org/en/)
* [TypeScript](https://www.typescriptlang.org)
* The extension packaging tool (TFX)
```npm install -g tfx-cli```

### Deployment

* Compile TypeScript
```tsc -p .```
* Run the TFX tool's packaging command. This will imcrement the revision version in vss-extension.json automatically.
```tfx extension create --rev-version```
    * To increment the major or minor version, update the version number in vss-extension.json and run the above
    command, omitting the `--rev-version` argument.
* Upload the .vsix file to the [management portal](https://aka.ms/vsmarketplace-manage)
