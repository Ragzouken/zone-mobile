let localName = undefined;

async function start() {
    const client = new ZoneClient("https://tinybird.zone/");

    const log = ONE("#chat-log");
    const chatInput = ONE("#chat-text");
    const chatButton = ONE("#chat-send");

    const chatCommands = new Map();
    chatCommands.set("name", rename);

    function rename(name) {
        localStorage.setItem('name', name);
        localName = name;
        client.rename(name);
    }

    function sendChat() {
        const line = chatInput.value;
        const slash = line.match(/^\/([^\s]+)\s*(.*)/);

        if (slash) {
            const command = chatCommands.get(slash[1]);
            if (command) {
                const promise = command(slash[2].trim());
                if (promise) promise.catch((error) => logStatus(colorText(`${line} failed: ${error.message}`, "#ff00ff")));
            } else {
                logStatus(colorText(`no command /${slash[1]}`, "#ff00ff"));
            }
        } else if (line.length > 0) {
            client.chat(parseFakedown(line));
        }

        chatInput.value = '';
    }

    chatButton.addEventListener("click", () => sendChat());

    window.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            sendChat();
        }
    });

    function colorText(text, color) {
        return html("span", { style: `color: ${color}` }, text);
    }

    function username(user) {
        const color = getUserColor(user.userId);
        const tile = decodeTile(user.avatar, color).canvas.toDataURL();
        return [colorText(user.name, color), html("img", { class: "chat-avatar", src: tile })];
    }

    function logChat(...elements) {
        const root = html("div", { class: "chat-message" }, ...elements);
        log.append(root);
        root.scrollIntoView();
        return root;
    }

    function logStatus(...elements) {
        logChat(
            colorText("! ", "#ff00ff"),
            ...elements
        );
    }

    function logJoin(user) {
        const color = getUserColor(user.userId);
        const tile = decodeTile(user.avatar, color).canvas.toDataURL();

        logStatus(
            ...username(user),
            colorText("joined", "#ff00ff"),
        );
    }

    client.on("join", (data) => {
        logJoin(data.user);
    });

    client.on("chat", (data) => {
        logChat(
            ...username(data.user),
            data.text,
        );
    });

    client.on("rename", (data) => {
        if (data.local) {
            logStatus(colorText("you are ", "#ff00ff"), ...username(data.user));
        } else {
            logStatus(colorText(data.previous, getUserColor(data.user.userId)), colorText(" is now ", "#ff00ff"), ...username(data.user));
        }
    });

    client.on('leave', (event) => logStatus(...username(event.user), colorText("left", "#ff00ff")));
    client.on('status', (event) => logStatus(colorText(event.text, "#ff00ff")));

    client.on('queue', ({ item }) => {
        const { title, duration } = item.media;
        const user = item.info.userId ? client.zone.users.get(item.info.userId) : undefined;
        const usern = user ? username(user) : ['server'];
        const time = secondsToTime(duration / 1000);
        if (item.info.banger) {
            logChat(
                colorText(`+ ${title} (${time}) rolled from `, "#00ffff"),
                colorText("bangers", "#ff00ff"),
                colorText(" by ", "#00ffff"),
                ...usern,
            );
        } else {
            logChat(
                colorText(`+ ${title} (${time}) added by `, "#00ffff"),
                ...usern,
            );
        }

        // refreshQueue();
    });
    client.on('unqueue', ({ item }) => {
        // chat.log(`{clr=#008888}- ${item.media.title} unqueued`);
        // refreshQueue();
    });

    client.on('play', async ({ message: { item, time } }) => {
        if (!item) {
            // player.stopPlaying();
        } else {
            // player.setPlaying(item, time || 0);

            const { title, duration } = item.media;
            const time = secondsToTime(duration / 1000);
            logChat(
                colorText(`> ${title} (${time}) rolled from `, "#00ffff"),
            );
        }
    });

    await client.join({ name: "zone-mobile-test" });

    const users = [];
    Array.from(client.zone.users).forEach(([, { userId, name }]) => {
        users.push(html("span", { style: `color: ${getUserColor(userId)}` }, name));
        users.push(", ");
    });
    users.pop();

    log.append(html("div", { class: "chat-message", style: "color: #00ff00" }, "*** connected ***"));
    log.append(html("div", { class: "chat-message", style: "color: #ff00ff" }, `${client.zone.users.size} users: `, ...users));
}

function decodeTile(data, color) {
    const rendering = createRendering2D(8, 8);
    const image = rendering.getImageData(0, 0, 8, 8);
    decodeM1(base64ToUint8(data), image.data, hexToUint32(color));
    rendering.putImageData(image, 0, 0);
    return rendering;
}

var WHITE = 0xffffffff;
var CLEAR = 0x00000000;
function decodeM1(data, pixels, white = WHITE, clear = CLEAR) {
    var pixels32 = new Uint32Array(pixels.buffer);
    for (var i = 0; i < data.length; ++i) {
        for (var bit = 0; bit < 8; ++bit) {
            if (i * 8 + bit < pixels32.length) {
                var on = (data[i] >> bit) & 1;
                pixels32[i * 8 + bit] = on ? white : clear;
            }
        }
    }
};
function encodeM1(pixels) {
    var pixels32 = new Uint32Array(pixels.buffer);
    var data = new Uint8ClampedArray(Math.ceil(pixels32.length / 8));
    for (var i = 0; i < data.length; ++i) {
        var byte = 0;
        for (var bit = 0; bit < 8; ++bit) {
            byte <<= 1;
            byte |= pixels32[i * 8 + (7 - bit)] > 0 ? 1 : 0;
        }
        data[i] = byte;
    }
    return data;
};
function base64ToUint8(base64) {
    var raw = window.atob(base64);
    var rawLength = raw.length;
    var array = new Uint8ClampedArray(new ArrayBuffer(rawLength));
    for (var i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }
    return array;
}
function uint8ToBase64(u8Arr) {
    var CHUNK_SIZE = 0x8000; // arbitrary number
    var index = 0;
    var length = u8Arr.length;
    var result = '';
    while (index < length) {
        var slice = u8Arr.subarray(index, Math.min(index + CHUNK_SIZE, length));
        result += String.fromCharCode.apply(null, slice);
        index += CHUNK_SIZE;
    }
    return btoa(result);
}

let hsl2hsv = (h,s,l,v=s*Math.min(l,1-l)+l) => [h, v?2-2*l/v:0, v];

const colorCount = 16;
const colors = [];
for (let i = 0; i < colorCount; ++i) {
    const [h, s, v] = hsl2hsv(i / colorCount, 1, .65);
    const color = rgbToHex(HSVToRGB({ h, s, v }));
    colors.push(color);
}

function getUserColor(userId) {
    const i = parseInt(userId, 10) % colors.length;
    const color = colors[i];
    return color;
}

const pad2 = (part) => (part.toString().length >= 2 ? part.toString() : '0' + part.toString());
function secondsToTime(seconds) {
    if (isNaN(seconds)) return '??:??';

    const s = Math.floor(seconds % 60);
    const m = Math.floor(seconds / 60) % 60;
    const h = Math.floor(seconds / 3600);

    return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

function parseFakedown(text) {
    text = fakedownToTag(text, '##', 'shk');
    text = fakedownToTag(text, '~~', 'wvy');
    text = fakedownToTag(text, '==', 'rbw');
    return text;
}

function fakedownToTag(text, fd, tag) {
    const pattern = new RegExp(`${fd}([^${fd}]+)${fd}`, 'g');
    return text.replace(pattern, `{+${tag}}$1{-${tag}}`);
}
