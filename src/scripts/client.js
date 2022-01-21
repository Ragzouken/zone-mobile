function createSocket(url, ticket) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(`wss://${url.host}/zone/${ticket}`);
        socket.addEventListener('open', () => resolve(socket));
        socket.addEventListener('error', reject);
    });
}

class EventEmitter extends EventTarget {
    constructor() {
        super();

        this.wrappers = new Map();
    }

    on(type, callback) {
        const wrapper = (event) => callback(event.detail);
        this.wrappers.set(callback, wrapper);
        this.addEventListener(type, wrapper);
        return () => this.off(type, callback);
    }

    off(type, callback) {
        const wrapper = this.wrappers.get(callback);
        this.wrappers.delete(callback);
        this.removeEventListener(type, wrapper);
    }

    emit(type, data) {
        this.dispatchEvent(new CustomEvent(type, { detail: data }));
    }
}

class ZoneState {
    constructor() {
        this.users = new Map();
    }
}

class ZoneClient extends EventEmitter {
    constructor(urlRoot) {
        super();
        this.urlRoot = new URL(urlRoot);
        this.messaging = new Messaging();
        this.zone = new ZoneState();

        this.messaging.on('close', (code) => {
            const clean = code <= 1001 || code >= 4000;
            this.emit('disconnect', { clean });
        });
        this.messaging.messages.on('chat', (message) => {
            const user = this.zone.users.get(message.userId);
            const local = message.userId === this.credentials.userId;
            this.emit('chat', { user, text: message.text, local });
        });
        this.messaging.messages.on('users', (message) => {
            this.zone.users.clear();
            message.users.forEach((user) => {
                this.zone.users.set(user.userId, user);
            });
            this.emit('users', {});
        });
        this.messaging.messages.on('user', (message) => {
            const user = this.zone.users.get(message.userId) ?? { userId: message.userId, emotes: [], tags: [] };
            this.zone.users.set(message.userId, user);
            const local = message.userId === this.credentials?.userId;

            const prev = { ...user };
            const { userId, ...changes } = message;

            if (local && prev.position && changes.position) delete changes.position;

            Object.assign(user, changes);

            if (!prev.name) {
                this.emit('join', { user });
            } else if (prev.name !== user.name) {
                this.emit('rename', { user, local, previous: prev.name });
            }
            
            if (changes.position !== undefined) this.emit('move', { user, local, position: changes.position });
            if (changes.emotes) this.emit('emotes', { user, local, emotes: changes.emotes });
            if (changes.avatar) this.emit('avatar', { user, local, data: changes.avatar });
            if (changes.tags) this.emit('tags', { user, local, tags: changes.tags });
        });
        this.messaging.messages.on('leave', (message) => {
            const user = this.zone.users.get(message.userId);
            if (!user) return;
            this.zone.users.delete(message.userId);
            this.emit('leave', { user });
        });
        this.messaging.messages.on('play', (message) => {
            // this.zone.lastPlayedItem = message.item;
            // if (message.item) unqueue(message.item.itemId);
            this.emit('play', { message });
        });
        this.messaging.messages.on('queue', (message) => {
            // this.zone.queue.push(...message.items);
            if (message.items.length === 1) this.emit('queue', { item: message.items[0] });
        });
        this.messaging.messages.on('unqueue', (message) => {
            // unqueue(message.itemId);
        });
    }

    async join({ name = "anonymous", avatar = "" } = {}) {
        const { ticket, token, userId } = await this.request("POST", "https://tinybird.zone/zone/join", { name, avatar });
        this.credentials = { userId, token };

        const socket = await createSocket(this.urlRoot, ticket);
        this.messaging.setSocket(socket);

        await this.expect("ready");
    }

    async rename(name) {
        // return new Promise((resolve, reject) => {
        //     setTimeout(() => reject('timeout'), this.options.quickResponseTimeout);
        //     specifically(
        //         this.messaging.messages,
        //         'user',
        //         (message) => message.userId === this.localUserId && message.name === name,
        //         resolve,
        //     );
        //     this.messaging.send('user', { name });
        // });

        this.messaging.send('user', { name });
    }

    async chat(text) {
        this.messaging.send('chat', { text });
    }

    async request(method, url, body) {
        url = new URL(url, this.urlRoot);
        const mode = "cors";

        /** @type {HeadersInit} */
        const headers = {};
    
        if (body) {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify(body);
        }

        return fetch(url, { mode, method, headers, body }).then(async (response) => {
            if (response.ok) return response.json().catch(() => {});
            throw new Error(await response.text());
        });
    }

    async expect(type, timeout = undefined) {
        return new Promise((resolve, reject) => {
            if (timeout) setTimeout(() => reject('timeout'), timeout);
            once(this.messaging.messages, type).then((message) => resolve(message));
        });
    }
}

class Messaging extends EventEmitter {
    constructor() {
        super();

        this.socket = undefined;
        this.messages = new EventEmitter();
        this.closeListener = (event) => this.emit('close', event.code || event);
    }

    setSocket(socket) {
        if (this.socket) {
            this.socket.removeEventListener('close', this.closeListener);
            this.socket.close();
        }

        this.socket = socket;
        this.socket.addEventListener('close', this.closeListener);
        this.socket.addEventListener('message', (event) => {
            const { type, ...message } = JSON.parse(event.data);
            this.messages.emit(type, message);
        });
    }

    async close(code = 1000) {
        if (!this.socket || this.socket.readyState === 3) return;
        const waiter = once(this, 'close');
        this.socket.close(code);
        await waiter;
    }

    send(type, message) {
        if (!this.socket) {
            this.emit('error', new Error('no socket'));
            return;
        } else if (this.socket.readyState !== 1) {
            this.emit('error', new Error('socket not open'));
            return;
        }

        const data = JSON.stringify({ type, ...message });

        try {
            this.socket.send(data);
        } catch (e) {
            this.emit('error', e);
        }
    }
}

function once(emitter, type) {
    return new Promise((resolve, reject) => {
        const remove = emitter.on(type, (event) => {
            remove();
            resolve(event);
        });
    });
}
