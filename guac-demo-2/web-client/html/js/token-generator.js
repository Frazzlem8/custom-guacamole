/**
 * Token generator for guacamole-lite
 * 
 * NOTE: In production, this should be done SERVER-SIDE to protect credentials!
 * This is only for demo purposes.
 */

async function generateGuacamoleToken(tokenObj) {
    const CIPHER = 'AES-256-CBC';
    const KEY = new TextEncoder().encode('MySuperSecretKeyForParamsToken12');

    const iv = crypto.getRandomValues(new Uint8Array(16));
    const algo = { name: "AES-CBC", iv };
    const key = await crypto.subtle.importKey("raw", KEY, algo, false, ["encrypt"]);
    const ct = new Uint8Array(await crypto.subtle.encrypt(algo, key,
        new TextEncoder().encode(JSON.stringify(tokenObj))));

    const token = btoa(JSON.stringify({
        iv: btoa(String.fromCharCode(...iv)),
        value: btoa(String.fromCharCode(...ct))
    }));

    return token;
}
