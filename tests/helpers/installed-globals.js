const installedGlobalKeys = [
  'window', 'self', 'document', 'fetch', 'Request', 'Response', 'Headers',
  'Blob', 'File', 'FileReader', 'DOMException', 'URL', 'URLSearchParams',
  'Image', 'HTMLImageElement', 'Event', 'EventTarget', 'PointerEvent'
];

function exposeInstalledGlobals(host) {
  const descriptors = new Map(installedGlobalKeys.map(key => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key)
  ]));

  installedGlobalKeys.forEach(key => {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: host[key]
    });
  });

  return () => {
    installedGlobalKeys.forEach(key => {
      const descriptor = descriptors.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    });
  };
}

export { exposeInstalledGlobals };
