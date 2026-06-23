async function getKey(password) {
    const enc = new TextEncoder();
    const rawKey = enc.encode(password);

    const hash = await crypto.subtle.digest("SHA-256", rawKey);

    return crypto.subtle.importKey(
        "raw",
        hash,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
    );
}

async function decryptFile(password, buffer) {
    const key = await getKey(password);

    const iv = buffer.slice(0, 12);
    const tag = buffer.slice(12, 28);
    const ciphertext = buffer.slice(28);

    const combined = new Uint8Array([
        ...new Uint8Array(ciphertext),
        ...new Uint8Array(tag)
    ]);

    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        combined
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
}
``