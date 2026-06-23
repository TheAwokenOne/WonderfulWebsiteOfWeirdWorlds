async function getKey(password) {
    const enc = new TextEncoder();
    const hash = await crypto.subtle.digest("SHA-256", enc.encode(password));

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
    const data = buffer.slice(12); // ciphertext + tag combined

    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        data
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
}
``