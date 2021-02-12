const { app, BrowserWindow, Menu, ipcMain, clipboard } = require('electron');
const contextMenu = require('electron-context-menu');
const path = require('path');
const fs = require('fs');
const nodeCrypto = require('crypto');
const algorithm = 'aes-256-gcm';
const bip39 = require('bip39');
const { v4: uuidv4 } = require('uuid');
const base58 = require(path.join(__dirname, '../static/scripts/base58.js'));
const keccak256 = require('js-sha3').keccak256;
const argon2 = require('argon2');
const saltpack = require('@samuelthomas2774/saltpack');
const tweetnacl = require('tweetnacl');
const dirName = 'saltpack-simplegui/Profiles';
const dataPath = path.join(app.getPath('appData'), '/' + dirName + '/');
const reloadPath = path.join(app.getPath('appData'), '/' + dirName + '/rl');
const labelPattern = /^[a-zA-Z0-9_]{3,16}$/g;
const versionByte = 96;

// argon2 settings
const type = argon2.argon2id;
const memoryCost = 2 ** 18;
const timeCost = 12;

Menu.setApplicationMenu(false);

var clipboardTimeout
var keyring
var mainWindow
var receiver
var silly

contextMenu({
    showLookUpSelection: false,
    showSearchWithGoogle: false,
    showCopyImage: false,
    showInspectElement: true,
    menu: (actions) => [
        actions.copy(),
        actions.paste(),
        // actions.inspect()
    ]
});

function createWindow() {

    makeWorkingDir();

    mainWindow = new BrowserWindow({
        width: process.platform === 'win32' ? 835 : 810,
        height: process.platform === 'win32' ? 645 : 610,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            worldSafeExecuteJavaScript: true,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, '../static/scripts/preload.js'),
            spellcheck: false,
            backgroundThrottling: false

        },
        icon: path.join(__dirname, '../static/icons/folder.png')
    });

    mainWindow.setResizable(false);
    mainWindow.setMinimizable(true);
    mainWindow.loadFile(path.join(__dirname, '../src/index.html'));
    // mainWindow.webContents.openDevTools()

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    })
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
})

ipcMain.on('toMain', (event, args) => {

    // console.log('args.type: ' + args.type);

    switch (args.type) {
        case 'getKeyringNames':
            sendResponeObject({
                type: 'keyringNames',
                keyRingNames: getKeyringNames()
            });
            break;
        case 'genKeyring':
            genKeyring(args.label, args.password, null);
            break;
        case 'loadKeyring':
            if (args.password.length < 8) return sendResponeObject({ type: 'authFailed' });
            loadKeyring(args.label, args.password);
            break;
        case 'changePassword':
            changePassword(args.oldPass, args.newPass, args.newPasS);
            break;
        case 'getMnemonic':
            getMnemonic(args.password);
            break;
        case 'restore':
            genKeyring(args.label, args.password, args.mnemonic);
            break;
        case 'addContact':
        case 'edit':
            if (!args.label || !args.key || !args.label.match(labelPattern)) {
                return sendMessage('Invalid input');
            }
            if (typeof args.note === 'string' && args.note !== '') {
                if (args.note.length >= 16 || !args.note.match(labelPattern)) {
                    return sendMessage('Invalid input');
                }
            }
            addContact(args.label, args.key, args.note);
            break;
        case 'removeContact':
            removeContact(args.label);
            break;
        case 'setReceiver':
            receiver = keyring.identities.find(ident => ident.ident_label == args.receiver);
            sendResponeObject({
                type: 'setReceiverSuccess',
                receiver: receiver.ident_label,
                receiverKey: receiver.ident_pKey,
                receiverNote: receiver.ident_note
            });
            break;
        case 'encryptMessage':
            encryptMessage(args.message, args.toSelf);
            break;
        case 'decryptMessage':
            decryptMessage(args.encMessage);
            break;
        case 'clipboard':
            writeDataToClipboard(args.content);
            break;
        case 'clipboardPKey':
            writeAddressToClipboard(args.content, args.label);
            break;
        case 'exit':
            keyring = null
            // clipboard.writeText('')
            fs.writeFileSync(reloadPath);
            mainWindow.reload();

            if (fs.existsSync(reloadPath)) {

                setTimeout(() => {
                    fs.unlinkSync(reloadPath);
                    sendResponeObject({ type: 'exitSuccess' });
                }, 200);
            }
            break;
        default:
            break;
    }
});

function makeWorkingDir() {
    try {
        fs.mkdirSync(dataPath);
    } catch (error) {
        // I don't care
    }
}

function sendMessage(message) {
    mainWindow.webContents.send('fromMain', {
        type: 'message',
        message: message
    });
}

function sendResponeObject(responseObject) {
    mainWindow.webContents.send('fromMain', responseObject);
}

function getKeyringNames() {
    let filenames = fs.readdirSync(dataPath);
    let encFiles = filenames.filter(file => file.includes('.enc'));
    let identities = [];
    encFiles.forEach(element => {
        identities.push(element.split('.').slice(0, -1).join('.'))
    });
    return identities;
}

function getPublicKeys() {

    let publicKeys = [];
    if (keyring.identities.length === 0) return
    keyring.identities.forEach(element => {
        publicKeys.push({
            label: element.ident_label,
            publicKey: Uint8Array.from(Buffer.from(element.ident_publicKey, 'hex'))
        });
    });
    publicKeys.push({
        label: 'yourself',
        publicKey: Uint8Array.from(Buffer.from(keyring.self_pubicKey, 'hex'))
    });
    return publicKeys;
}

function getPKey() {
    let addressData = versionByte.toString(16) + keyring.self_pubicKey;
    let checksum = keccak256(addressData).substring(0, 2 * 6);
    let address = base58.encode(addressData + checksum);
    return address;
}

function validateAndGetKey(pKey) {

    if (pKey.length != 54) return false;
    let decoded = base58.decode(pKey);
    let dataToValidate = decoded.slice(0, -(2 * 6));
    let extractedChecksum = keccak256(dataToValidate).substring(0, 2 * 6);
    let checksum = keccak256(dataToValidate).substring(0, 2 * 6);

    if (extractedChecksum == checksum) {
        return dataToValidate.slice(2);
    } else {
        return false;
    }
}

async function encryptAndStoreActualKeyring(responseObject, backgroundSave) {

    if (backgroundSave) sendResponeObject(responseObject);

    const iv = nodeCrypto.randomBytes(16);
    const salt = nodeCrypto.randomBytes(16);
    let objAsString = JSON.stringify(keyring);

    const derivedAESKey = await argon2.hash(silly, {
        memoryCost: memoryCost,
        timeCost: timeCost,
        type: type,
        salt: salt,
        raw: true
    })

    try {
        let cipher = nodeCrypto.createCipheriv(algorithm, derivedAESKey, iv);
        var encrypted = cipher.update(objAsString, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        let tag = cipher.getAuthTag();

        let json = {
            content: encrypted,
            salt: salt.toString('hex'),
            tag: tag.toString('hex'),
            iv: iv.toString('hex')
        }

        let temp = keyring.identities.sort(function (a, b) {
            if (a.ident_label < b.ident_label) {
                return -1;
            }
            if (a.ident_label > b.ident_label) {
                return 1;
            }
            return 0;
        })

        keyring.identities = temp;

        fs.writeFileSync(path.join(dataPath + keyring.self_label + '.enc'), JSON.stringify(json));

        if (backgroundSave) {
            sendResponeObject({ type: 'stopIndicator' });
        } else {
            sendResponeObject(responseObject);
        }
    } catch (error) {
        keyring = null;
        sendResponeObject({ type: 'genFailed' });
    }
}

async function genKeyring(label, password, mnemonic) {

    if (!label || !label.match(labelPattern) || !password || password.length < 8) {
        return sendResponeObject({
            type: 'genFailed',
            message: 'Invalid input'
        });
    }
    silly = password

    let isGen = 'Generation';
    if (mnemonic) isGen = 'Restore';

    if (fs.existsSync(path.join(dataPath + label + '.enc'))) {
        return sendResponeObject({
            type: 'genFailed',
            message: isGen + ' failed: ' + label + '\nalready exists'
        });
    }

    if (!mnemonic) mnemonic = bip39.generateMnemonic();
    if (!bip39.validateMnemonic(mnemonic)) {
        return sendResponeObject({
            type: 'genFailed',
            message: isGen + ' failed: Invalid mnemonic'
        });
    }

    let seed = bip39.mnemonicToSeedSync(mnemonic);
    let derivedKey = await argon2.hash(seed, {
        memoryCost: memoryCost,
        timeCost: timeCost,
        type: type,
        raw: true,
        salt: Buffer.from('mnemonic')
    })

    let keyPair = tweetnacl.box.keyPair.fromSecretKey(derivedKey);

    const argon2hash = await argon2.hash(password, {
        type: type
    });

    keyring = {
        'self_id': uuidv4(),
        'self_label': label,
        'self_pubicKey': Buffer.from(keyPair.publicKey).toString('hex'),
        'self_secretKey': Buffer.from(keyPair.secretKey).toString('hex'),
        'self_mnemonic': mnemonic,
        'self_channes': [],
        'hash': argon2hash,
        'identities': []
    }

    encryptAndStoreActualKeyring({
        type: 'authSuccess',
        label: keyring.self_label,
        pKey: getPKey(),
        identities: []
    }, false);
}

async function loadKeyring(label, password) {

    silly = password

    let data = JSON.parse(fs.readFileSync(path.join(dataPath + label + '.enc')));

    let salt = Buffer.from(data.salt, 'hex')
    let iv = Buffer.from(data.iv, 'hex');
    let tag = Buffer.from(data.tag, 'hex');


    const derivedAESKey = await argon2.hash(password, {
        memoryCost: memoryCost,
        timeCost: timeCost,
        type: type,
        salt: salt,
        raw: true
    })

    try {
        const decipher = nodeCrypto.createDecipheriv(algorithm, derivedAESKey, iv);
        decipher.setAuthTag(tag);
        var dec = decipher.update(data.content, 'hex', 'utf8');
        dec += decipher.final('utf8');
        dec.toString();
        keyring = JSON.parse(dec);

        sendResponeObject({
            type: 'authSuccess',
            label: keyring.self_label,
            pKey: getPKey(),
            identities: keyring.identities
        });

    } catch (error) {
        sendResponeObject({
            type: 'authFailed'
        });
    }
}

async function changePassword(oldPass, newPass, newPasS) {

    if (oldPass == newPass) return sendMessage('Are you kidding me? 😞');
    if (newPass != newPasS) return sendMessage('The passwords\ndid not match');

    if (await argon2.verify(keyring.hash, oldPass)) {
        silly = newPass
        const argon2hash = await argon2.hash(newPass, {
            type: type
        });

        keyring.hash = argon2hash;

        let responseObject = {
            type: 'message',
            message: 'Password changed'
        }

        encryptAndStoreActualKeyring(responseObject, true);
    } else {
        sendMessage('Invalid password');
    }
}

async function getMnemonic(password) {
    if (await argon2.verify(keyring.hash, password)) {
        sendResponeObject({
            type: 'mnemonic',
            mnemonic: keyring.self_mnemonic
        });
    } else {
        sendMessage('Invalid password');
    }
}

function addContact(label, pKey, note) {

    let key = validateAndGetKey(pKey);
    if (!key) return sendMessage('Key validation failed');

    let doc = {
        'ident_id': uuidv4(),
        'ident_label': label,
        'ident_pKey': pKey,
        'ident_publicKey': key,
        'ident_note': note,
        'ident_channels': null
    }

    let responseObject = {
        type: 'addSuccess',
        message: 'Added: ' + label,
        receiverKey: pKey,
        receiverNote: note,
        identities: keyring.identities
    }

    let i = 0;
    let dupe = false;
    let length = keyring.identities.length;

    if (length) {
        keyring.identities.forEach(element => {
            if (element.ident_label == label) {
                dupe = true;
                keyring.identities[i] = doc;
            }
            i++
            if (i == length) {
                if (dupe) {
                    responseObject.type = 'updateSuccess';
                    responseObject.message = 'Updated: ' + label;
                } else {
                    keyring.identities.push(doc);
                }
                encryptAndStoreActualKeyring(responseObject, true);
            }
        });
    } else {
        keyring.identities.push(doc);
        encryptAndStoreActualKeyring(responseObject, true);
    }

}

function removeContact(label) {

    let result = []
    keyring.identities.forEach(element => {
        if (element.ident_label != label) result.push(element)
    });

    keyring.identities = result;

    encryptAndStoreActualKeyring({
        type: 'removeSuccess',
        message: 'Removed: ' + label,
        identities: keyring.identities
    }, true);

}

async function encryptMessage(plaintext, toSelf) {

    const sender_keypair = {
        publicKey: Uint8Array.from(Buffer.from(keyring.self_pubicKey, 'hex')),
        secretKey: Uint8Array.from(Buffer.from(keyring.self_secretKey, 'hex'))
    }

    let ownPublicKey = Uint8Array.from(Buffer.from(keyring.self_pubicKey, 'hex'));
    let publicKey = Uint8Array.from(Buffer.from(receiver.ident_publicKey, 'hex'));

    const recipients_keys = [
        publicKey,
    ];

    if (toSelf) recipients_keys.push(ownPublicKey);

    const encrypted = await saltpack.encryptAndArmor(plaintext, sender_keypair, recipients_keys);

    sendResponeObject({
        type: 'encrypted',
        encrypted: encrypted
    });
};

async function decryptMessage(encMessage) {

    const recipient_keypair = {
        publicKey: Uint8Array.from(Buffer.from(keyring.self_pubicKey, 'hex')),
        secretKey: Uint8Array.from(Buffer.from(keyring.self_secretKey, 'hex'))
    }

    let toSelf = false, result = null;
    let publicKeys = getPublicKeys();

    try {
        const decrypted = await saltpack.dearmorAndDecrypt(encMessage, recipient_keypair);

        publicKeys.forEach(async (element) => {
            if (Buffer.from(decrypted.sender_public_key).equals(element.publicKey)) {
                result = element.label;
                if (element.label == 'yourself') toSelf = true;
            }
        });

        if (decrypted) {
            sendResponeObject({
                type: 'decrypted',
                sender: result,
                toSelf: toSelf,
                decrypted: decrypted.toString('utf8'),
                message: 'Decryption success'
            });
        }
    } catch (error) {
        sendResponeObject({
            type: 'decryptFailed',
            message: 'Decryption failed'
        });
    }
}

function writeDataToClipboard(data) {
    clipboard.writeText(data);

    clearTimeout(clipboardTimeout);
    clipboardTimeout = setTimeout(() => {
        if (clipboard.readText() == data) clipboard.writeText('');
    }, 1000 * 10);

    let clipboardInterval = setInterval(() => {

        let temp = clipboard.readText();
        if (temp != data) {
            clearInterval(clipboardInterval);
            clearTimeout(clipboardTimeout);

            sendResponeObject({ type: 'clipTimerCleared' });
        }
    }, 100);

    sendResponeObject({
        type: 'clipboardSuccess',
        message: 'The message is in\nyour clipboard until this\nnotification disappears'
    });
}

function writeAddressToClipboard(data, label) {
    clipboard.writeText('');

    clipboard.writeText(data);
    setTimeout(() => {
        clipboard.writeText(data);
        let message = 'Your key is now\nin your clipboard'
        if (label) message = label.charAt(0).toUpperCase() + label.slice(1) + '\'s key is now\nin your clipboard'
        sendResponeObject({
            type: 'clipboardPKeySuccess',
            message: message
        });
    }, 120);
}

