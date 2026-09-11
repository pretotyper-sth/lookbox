const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('LookboxNative', {
  embeddedWebview: true,
});
