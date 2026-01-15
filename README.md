# MMM-Assistant
Use this module to add a local LLM-powered voice assistant to your MagicMirror.

## Screenshot

![Example of MMM-Template](./example.png)

## Installation

### Install

In your terminal, go to the modules directory and clone the repository:

```bash
cd ~/MagicMirror/modules
git clone https://github.com/rahil234/MMM-Assistant.git
```

### Update

Go to the module directory and pull the latest changes:

```bash
cd ~/MagicMirror/modules/MMM-Assistant
git pull
```

## Configuration

To use this module, you have to add a configuration object to the modules array in the `config/config.js` file.

### Example configuration

Minimal configuration to use the module:

```js
    {
        module: 'MMM-Assistant',
        position: 'lower_third'
    },
```

Configuration with all options:

```js
    {
        module: "MMM-Assistant",
        position: "lower_third",
        config: {
          llmEndpoint: "http://localhost:11434/api/generate",
          model: "llama3.1:8b",
          systemPrompt: "You are a helpful voice assistant for a MagicMirror. Answer concisely.",
          responseClearDelay: 5000,
          volume: 0.5;
        }
    },
```

## Developer commands

- `npm install` - Install devDependencies like ESLint.
- `node --run lint` - Run linting and formatter checks.
- `node --run lint:fix` - Fix linting and formatter issues.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.

## Changelog

All notable changes to this project will be documented in the [CHANGELOG.md](CHANGELOG.md) file.
