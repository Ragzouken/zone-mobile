async function start() {
    const client = new ZoneClient("https://tinybird.zone/");

    const log = ONE("#chat-log");
    const input = ONE("#chat-text");
    const send = ONE("#chat-send");

    send.addEventListener("click", () => {
        client.chat(input.value);
        input.value = "";
    });

    window.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            client.chat(input.value);
            input.value = "";
        }
    });

    client.on("chat", (data) => {
        const color = getUserColor(data.user.userId);
        const tile = decodeTile(data.user.avatar, color).canvas.toDataURL();
        const name = html("span", { class: "chat-name", style: `color: ${color}` }, data.user.name)
        const avi = html("img", { class: "chat-avatar", src: tile });
        const root = html("div", { class: "chat-message" }, name, avi, data.text);
        log.append(root);
    });

    await client.join({ name: "zone-mobile-test" });
    log.append(html("div", { class: "chat-message", style: "color: #00ff00" }, "*** connected ***"));
    log.append(html("div", { class: "chat-message", style: "color: #ff00ff" }, `${client.zone.users.size} users:`));
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
