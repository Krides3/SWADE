const {app, BrowserWindow} = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';
const isMac = process.platform === 'darwin';  
 
function createMainWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    Title: "SWADE CC",
    icon: path.join(__dirname, 'assets', 'icon.png'),
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });


//open dev tools if in development mode
  
  mainWindow.webContents.openDevTools();
  if (isDev) {
    mainWindow.webContents.openDevTools();
  } else {
    // Remove the menu bar in production mode
    mainWindow.setMenuBarVisibility(false);
  }     

  // Load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, './renderer/index.html'));
  }





app.whenReady().then(() => {
  createMainWindow();
  
});


app.on('window-all-closed', () => {

  if (!isMac) {
    app.quit();
  }
});



  