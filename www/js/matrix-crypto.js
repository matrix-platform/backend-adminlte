/*global atob,btoa,console,crypto*/
/*jslint browser,long*/

(function () {

    let aes = null;
    let rsa = null;

    const init = async function () {
        if (aes) {
            return;
        }

        let iv;
        let key;
        let text = localStorage.getItem("MATRIX_AES");

        if (text) {
            const source = JSON.parse(text);

            iv = toUint8Array(source.iv);
            key = await crypto.subtle.importKey("raw", toUint8Array(source.key).buffer, {name: "AES-GCM"}, true, ["encrypt", "decrypt"]);
        } else {
            iv = crypto.getRandomValues(new Uint8Array(12));
            key = await crypto.subtle.generateKey({length: 256, name: "AES-GCM"}, true, ["encrypt", "decrypt"]);

            localStorage.setItem("MATRIX_AES", JSON.stringify({
                iv: btoa(String.fromCharCode(...iv)),
                key: btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey("raw", key))))
            }));
        }

        aes = {iv, key};
    };

    const toUint8Array = (text) => new Uint8Array(atob(text).split("").map((value) => value.charCodeAt(0)));

    window.aesDecrypt = async function (data) {
        await init();

        return new TextDecoder().decode(await crypto.subtle.decrypt({iv: aes.iv, name: "AES-GCM"}, aes.key, toUint8Array(data)));
    };

    window.aesEncrypt = async function (data) {
        await init();

        return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.encrypt({iv: aes.iv, name: "AES-GCM"}, aes.key, new TextEncoder().encode(data)))));
    };

    window.rsaEncrypt = async function (data) {
        if (!rsa) {
            const pem = await fetch("files/rsa-public-key").then((response) => response.text());

            rsa = await crypto.subtle.importKey("spki", toUint8Array(pem.substring(26, pem.length - 25)), {hash: "SHA-1", name: "RSA-OAEP"}, false, ["encrypt"]);
        }

        return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.encrypt({name: "RSA-OAEP"}, rsa, new TextEncoder().encode(data)))));
    };

}());
