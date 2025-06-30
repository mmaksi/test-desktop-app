# Electron App

A desktop application built with Electron that provides printing capabilities and automatic updates.

## Features

- Print current page with native print dialog
- Automatic updates through GitHub releases
- Modern, clean user interface

## Development

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Git

### Setup

1. Clone the repository:
```bash
git clone https://github.com/mmaksi/test-desktop-app.git
cd test-desktop-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

### Building

To build the application without publishing:
```bash
npm run build
```

### Publishing Updates

1. Update the version in `package.json`
2. Set your GitHub token:
```bash
export GH_TOKEN="your-token-here"
```
3. Deploy the new version:
```bash
npm run deploy
```

## Configuration

### Auto Updates

Auto updates are configured through GitHub releases. The application will:
- Check for updates on startup
- Allow manual update checks
- Download updates in the background
- Prompt for installation when ready

### Building for Different Platforms

The application can be built for:
- macOS (.dmg, .zip)
- Windows (.exe)

## License

ISC
