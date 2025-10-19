export type MessageData = { type: string; payload?: any; requestId?: string };

export interface CrossFrameOptions {
    origin?: string;
    handshakeToken?: string;
    debug?: boolean;
}

export class CrossFrame {
    private handlers = new Map<string, Function>();
    private target: Window;
    private origin: string;
    private pending: Record<string, (data: any) => void> = {};
    private handshakeCompleted = false;
    private handshakeToken?: string;
    private debugEnabled = false;
    private plugins: CrossFramePlugin[] = [];

    constructor(target: Window, options: CrossFrameOptions = {}) {
        this.target = target;
        this.origin = options.origin || "*";
        this.handshakeToken = options.handshakeToken;
        this.debugEnabled = options.debug || false;
        window.addEventListener("message", this.onMessage.bind(this));
    }

    private onMessage(event: MessageEvent) {
        if (this.debugEnabled) {
            console.log(`[CrossFrameJS] Parent → Iframe:`, event.data);
        }
        if (this.origin !== "*" && event.origin !== this.origin) return;
        let data = event.data as MessageData;
        data = this.applyAfterReceive(data);
        const { type, payload, requestId } = data;

        if (type === "handshake") {
            if (this.debugEnabled) {
                console.log(
                    `[CrossFrameJS] Iframe → Parent: Handshake received.`
                );
            }
            if (payload === this.handshakeToken) {
                this.send("handshake:response", payload);
                this.handshakeCompleted = true;
            } else {
                console.error(
                    `[CrossFrameJS] Iframe → Parent: Handshake token mismatch.`
                );
            }
            return;
        }

        if (requestId && this.pending[requestId]) {
            this.pending[requestId](payload);
            delete this.pending[requestId];
            return;
        }

        const handler = this.handlers.get(type);
        if (handler) {
            const res = handler(payload);
            if (requestId) {
                this.target.postMessage(
                    { type: `${type}:response`, payload: res, requestId },
                    this.origin
                );
            }
        }
    }

    on(type: string, handler: Function) {
        this.handlers.set(type, handler);
    }

    off(type: string, handler?: Function) {
        if (handler) {
            const existingHandler = this.handlers.get(type);
            if (existingHandler === handler) {
                this.handlers.delete(type);
            }
        } else {
            this.handlers.delete(type);
        }
    }

    send(type: string, payload?: any) {
        let message: MessageData = { type, payload };
        message = this.applyBeforeSend(message);
        this.target.postMessage(message, this.origin);
    }

    request<T = any>(type: string, payload?: any): Promise<T> {
        if (this.handshakeToken && !this.handshakeCompleted) {
            return Promise.reject(new Error("Handshake not completed."));
        }
        const requestId = Math.random().toString(36).slice(2);
        this.target.postMessage({ type, payload, requestId }, this.origin);

        return new Promise((resolve) => {
            this.pending[requestId] = resolve;
        });
    }

    handshake(): Promise<void> {
        if (this.handshakeCompleted) return Promise.resolve();
        if (!this.handshakeToken) {
            this.handshakeCompleted = true;
            return Promise.resolve();
        }
        if (this.debugEnabled) {
            console.log(
                `[CrossFrameJS] Parent → Iframe: Initiating handshake with token...`
            );
        }
        return new Promise((resolve) => {
            const token = this.handshakeToken;
            const onHandshakeResponse = (ackToken: string) => {
                if (ackToken === token) {
                    this.handshakeCompleted = true;
                    if (this.debugEnabled) {
                        console.log(
                            `[CrossFrameJS] Iframe → Parent: Handshake completed.`
                        );
                    }
                    this.off("handshake:response", onHandshakeResponse);
                    resolve();
                }
            };
            if (!document.readyState || document.readyState === "complete") {
                this.on("handshake:response", onHandshakeResponse);
                this.send("handshake", token);
                return;
            } else {
                window.onload = () => {
                    this.on("handshake:response", onHandshakeResponse);
                    this.send("handshake", token);
                };
            }
        });
    }

    channel(name: string): CrossFrameChannel {
        return new CrossFrameChannel(this, name);
    }

    destroy() {
        this.plugins.forEach((p) => p.teardown?.());
        window.removeEventListener("message", this.onMessage.bind(this));
        this.handlers.clear();
        this.pending = {};
    }

    use(plugin: CrossFramePlugin) {
        this.plugins.push(plugin);
        plugin.setup?.(this);
        if (this.debugEnabled) {
            console.log(`[CrossFrameJS] Plugin "${plugin.name}" applied.`);
        }
    }

    private applyBeforeSend(data: MessageData): MessageData {
        return this.plugins.reduce((msg, plugin) => {
            const result = plugin.beforeSend?.(msg);
            return result || msg;
        }, data);
    }

    private applyAfterReceive(data: MessageData): MessageData {
        return this.plugins.reduce((msg, plugin) => {
            const result = plugin.afterReceive?.(msg);
            return result || msg;
        }, data);
    }
}

export class CrossFrameChannel {
    private crossFrame: CrossFrame;
    private name: string;

    constructor(crossFrame: CrossFrame, name: string) {
        this.crossFrame = crossFrame;
        this.name = name;
    }

    on(type: string, handler: Function) {
        this.crossFrame.on(`${this.name}:${type}`, handler);
    }
    off(type: string, handler?: Function) {
        this.crossFrame.off(`${this.name}:${type}`, handler);
    }
    send(type: string, payload?: any) {
        this.crossFrame.send(`${this.name}:${type}`, payload);
    }
    request<T = any>(type: string, payload?: any): Promise<T> {
        return this.crossFrame.request(`${this.name}:${type}`, payload);
    }
}

export interface CrossFramePlugin {
    name: string;
    setup?(instance: CrossFrame): void;
    beforeSend?(data: MessageData): MessageData | void;
    afterReceive?(data: MessageData): MessageData | void;
    teardown?(): void;
}