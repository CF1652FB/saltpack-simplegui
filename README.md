## Saltpack SimpleGUI - a simple graphical user interface for saltpack  


![alt text](https://github.com/CF1652FB/saltpack-simplegui/raw/main/assets/img.png)


#### Allowed inputs:

	labels:		pattern="[a-zA-Z0-9_]{3,16}"
	passwords:	pattern=".{8,}"
	public keys:	pattern=".{54}"
	notes:		pattern="[a-zA-Z0-9_]{3,16}"
	mnemonics:	bip39 mnemonics


#### Profile encryption:

Each profile is stored encrypted on the hard drive (appdata/saltpack-simplegui/Profiles/label.enc). The cipher used is AES-256-GCM and the key is derived from your password (argon2id, memory cost: 256 MiB, 12 iterations).


#### Saltpack / TweetNaCl key generation:

The keypair is derived from a bip39 mnemonic (argon2id, memory cost: 256 MiB, 12 iterations). The mnemonic can be viewed after entering the profile password and kept as recovery mechanism.


#### Public key "armour":

The public keys for exchange are issued as follows:

base85(version byte (hex) + public key (hex) + checksum)

Whereby the base85 variant of monero* is used to always produce outputs of the same length and the checksum consists of the first six bytes of the keccak256 hash of the version byte and public key. This always results in 54 byte outputs. \* https://monerodocs.org/cryptography/base58/


#### Other matters:

* Two-factor mnemonic (mnemonic + password) is not implemented. 
* The respective profile password is kept in memory during runtime (due to convenience).
* The source code is not cleaned up in certain places.

For my purpose this is sufficient. If this is not the case for you please build your own version.  
It may also be reasonable to adjust the argon2 settings.


#### Build instructions:

Clone the repository and chdir into the package directory.  
Optionally adjust the build settings (package.json: "build": {})  
Optionally adjust the argon2 settings (main.js // argon2 settings - type, memoryCost, timeCost)  
Referece: https://github.com/ranisalt/node-argon2/wiki/Options

$ npm install --global yarn  
$ yarn install  
$ yarn dist

