# CrossFrameJS

> Type-safe, secure, and developer-friendly iframe communication SDK.

[![npm version](https://img.shields.io/npm/v/crossframejs.svg)](https://www.npmjs.com/package/crossframejs)
[![license](https://img.shields.io/npm/l/crossframejs)](LICENSE)
![bundle size](https://img.shields.io/bundlephobia/minzip/crossframejs)

---

## Overview

Working with `window.postMessage` is powerful — but messy.

**CrossFrameJS** makes it simple and safe to communicate between a **parent** web page and an **embedded iframe**, providing:

- RPC-style request/response communication  
- Type-safe message contracts  
- Optional handshake for security  
- Message queue for delayed iframe loads  
- Debug logs for development  

It’s ideal for building **embeddable widgets**, **micro frontends**, or **cross-domain integrations**.

---

## Installation

```bash
npm install crossframejs
# or
yarn add crossframejs
```

---


## Quick Example

### Parent Page

```typescript
import { createCrossFrame } from 'crossframejs';

const iframe = document.getElementById('child') as HTMLIFrameElement;

const parent = createCrossFrame(iframe.contentWindow!, {
  origin: 'https://child-app.com',
  handshakeToken: 'secret123', // optional handshake
});



parent.on('ready', () => {
  console.log('Child is ready')
  await parent.handshake(); // if handshakeToken is provided
});

const user = await parent.request('getUser', { id: 42 });
console.log('Got user:', user);

```

### Child Page

```typescript
import { connectCrossFrame } from 'crossframejs';

const child = connectCrossFrame(window.parent, {
  origin: 'https://parent-app.com',
  handshakeToken: 'secret123', // optional handshake
});

child.on('getUser', async ({ id }) => {
  const data = await fetch(`/api/users/${id}`).then(res => res.json());
  return data; // automatically sent back as response
});

child.send('ready');

```

### Output
```
Child is ready
{ id: 1, name: 'John Doe' }
```
---


## Type Safety Example
Use TypeScript to define your message schema and get autocomplete + type safety.

```typescript
type Messages = {
  getUser: { id: number };
  userData: { name: string };
};

const comm = new CrossFrame<Messages>(iframe.contentWindow, '*');
comm.send('getUser', { id: 1 });  // ✅ type checked
comm.send('unknown', {});         // ❌ compile-time error
```
---

## Channels
Organize communication logically:
```typescript
const auth = comm.channel('auth');
auth.send('login', { token });
auth.on('logout', handleLogout);
```
---

## Debug Mode

Enable structured logs for easier debugging:

```typescript
new CrossFrame(iframe.contentWindow, { debug: true });
// [CrossFrameJS] Parent → Iframe: getUser { id: 1 }
```
---

## Custom Plugins
```typescript
export class LoggerPlugin implements CrossFramePlugin {
    name = "LoggerPlugin";

    setup(instance: CrossFrame) {
        console.log(`[LoggerPlugin] Setup complete.`);
    }
    beforeSend(data: MessageData): MessageData {
        console.log(`[LoggerPlugin] Sending message:`, data);
        return data;
    }
    afterReceive(data: MessageData): MessageData {
        console.log(`[LoggerPlugin] Received message:`, data);
        return data;
    }
    teardown() {
        console.log(`[LoggerPlugin] Teardown complete.`);
    }
}

// ...

const comm = new CrossFrame(iframe.contentWindow, '*');
comm.use(new LoggerPlugin());

```
---

## React Example
```tsx
import { useCrossFrame } from 'crossframejs/react';

function Dashboard() {
  const { send, on } = useCrossFrame();

  useEffect(() => {
    on('updateTheme', (theme) => setTheme(theme));
  }, []);

  return <button onClick={() => send('ready')}>Notify Parent</button>;
}
```
---

## Playground Demo
Try the online demo (parent ↔ iframe communication):
[https://crossframejs-demo.vercel.app/](to be deployed)

---

## Contributing
Contributions are welcome!


## License
MIT

