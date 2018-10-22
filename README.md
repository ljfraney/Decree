# Decree

An Azure DevOps extension for creating global policies

## What is it?

Decree is an extension that allows you to convert a branch policy to a global policy. It is enforced across
all repositories in your project. Your organization may have more than one project. This tool will only
apply policies to repositories in the same project.

### Development Prerequisites

* Install [Node.js](https://nodejs.org/en/).
* Install the extension packaging tool (TFX).
```npm install -g tfx-cli```

### Deployment

* Run the TFX tool's packaging command.
```tfx extension create```
* Upload the .vsix file to the [management portal](https://aka.ms/vsmarketplace-manage).
