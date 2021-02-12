window.addEventListener('DOMContentLoaded', function (event) {
    window.api.send('toMain', {
        type: 'getKeyringNames'
    });

    var authed, receiverKey, receiverNote;
    var chars = ['◡', '⊙', '◠'];
    var indicatorInterval = false;

    function setIndicatior(stop) {
        if (indicatorInterval != false) clearInterval(indicatorInterval);
        indicatorInterval = false;
        $('#label').text(authed);

        if (stop) return;

        let int = 0;
        authed = $('#label').text();
        indicatorInterval = setInterval(() => {
            $('#label').text(authed + ' ' + chars[int++ % chars.length]);
        }, 100)
    }

    function focusOnText(element) {
        let toSelect = document.getElementById(element);
        let range, selection;
        selection = window.getSelection();
        range = document.createRange();
        range.selectNodeContents(toSelect);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    function openSeedToast(timeout) {
        setTimeout(() => {
            if ($('#auth').is(':visible')) seedToast.fire();
        }, timeout);
    }

    const seedToast = Swal.mixin({
        toast: true,
        title: '<a>Restore with mnemonic</a>',
        position: 'bottom-end',
        showConfirmButton: false,
        showClass: {
            popup: 'swal2-noanimation',
            backdrop: 'swal2-noanimation'
        },
        didClose: async function () {
            let { value: formValues } = await Swal.fire({
                title: 'Restore with mnemonic',
                showCancelButton: true,
                html:
                    '<input id="swal-input-mnemonic" title="bip39 mnemonic" pattern="" class="swal2-input" placeholder="mnemonic" value="">' +
                    '<input id="swal-input-label" title="[a-zA-Z0-9_]{3,16}" pattern="[a-zA-Z0-9_]{3,16}"" class="swal2-input" placeholder="label" value="">' +
                    '<input id="swal-input-password" title="Please enter at least 8 characters" pattern=".{8,}" class="swal2-input" placeholder="password" value="" type="password">',
                focusConfirm: false,
                didOpen: (swal) => {
                    $(swal).find('.swal2-confirm').css({ 'background-color': '#ffc02d', 'color': '#000' });
                    $('#swal-input-password').keypress(function (e) {
                        if (e.which == 13) {
                            $(swal).find('.swal2-confirm').click();
                            return false;
                        }
                    });
                },
                preConfirm: () => {
                    return {
                        type: 'restore',
                        mnemonic: $('#swal-input-mnemonic').val(),
                        label: $('#swal-input-label').val(),
                        password: $('#swal-input-password').val()
                    }
                }
            })
            if (formValues && formValues.mnemonic && formValues.label && formValues.password) {
                $('#authFormSubmit').val('Restoring keys');
                $('.lds-spinner').show();
                window.api.send('toMain', formValues);
            } else {
                seedToast.fire();
            }
        }
    })

    openSeedToast(1000 * 3);

    $('.hide').hide();

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1000 * 3,
        timerProgressBar: true,
    });

    $('#toSelf').on('change', function () {

        let toSelf = false;
        if (!$('#message').val()) return
        if (!$('#toSelf').val().includes('No')) toSelf = true;

        window.api.send('toMain', {
            type: 'encryptMessage',
            message: $('#message').val(),
            toSelf: toSelf
        });
    })
    $('#message').bind('input propertychange', function () {

        let toSelf = false;
        if (!$('#toSelf').val().includes('No')) toSelf = true;
        if (!$('#message').val()) return $('#encrypted').val('');

        window.api.send('toMain', {
            type: 'encryptMessage',
            message: $('#message').val(),
            toSelf: toSelf
        });
    });
    window.api.receive('fromMain', function (data) {

        switch (data.type) {
            case 'message':
                Toast.fire({
                    title: data.message
                });
                break;
            case 'encrypted':
                $('#encrypted').val(data.encrypted);
                break;
            case 'keyringNames':
                for (let i = 0; i < data.keyRingNames.length; i++) {
                    $('#labelSelect').append('<option value=' + data.keyRingNames[i] + '>' + data.keyRingNames[i] + '</option>');
                }
                break;
            case 'authFailed':
                drawAuthForm()
                Toast.fire({
                    title: 'Authentication failed!\nMake sure to use the correct password'
                });
                $('#password').val('');
                openSeedToast(1000 * 3);
                break;
            case 'addSuccess':
            case 'updateSuccess':
            case 'removeSuccess':
                resetEncView();
                openSettings();
                if (data.receiverKey) receiverKey = data.receiverKey;
                if (data.receiverNote) receiverNote = data.receiverNote;
                if (data.identities.length > 0) {
                    $('#toSelf').show();
                } else {
                    $('#toSelf').hide();
                }
                document.getElementById('receiver').options.length = 0;
                $('#receiver').append('<option>Select receiver</option>')
                if (data.identities.length > 0) {
                    $('#receiver').show();
                    for (let i = 0; i < data.identities.length; i++) {
                        let note = '';
                        if (data.identities[i].ident_note) note = ' (' + data.identities[i].ident_note + ')';
                        $('#receiver').append('<option value="' + data.identities[i].ident_label + '">' + data.identities[i].ident_label + note + '</option>');
                    }
                } else {
                    $('#receiver').hide();
                }
                Toast.fire({
                    title: data.message
                });
                break;
            case 'setReceiverSuccess':
                Toast.fire({
                    title: 'Set receiver: ' + data.receiver
                });
                receiverKey = data.receiverKey;
                receiverNote = data.receiverNote;
                $('#clipImage').attr('title', 'Copy ' + data.receiver + ' \'s key');
                break;
            case 'mnemonic':
                Swal.fire({
                    title: data.mnemonic,
                    didOpen: (swal) => {
                        $(swal).find('.swal2-confirm').css({ 'background-color': '#ffc02d', 'color': '#000' });
                        $(swal).find('.swal2-title').css({ 'user-select': 'auto' });
                        $(swal).find('.swal2-title').prop('id', 'fText');
                        $(swal).find('.swal2-title').click(function () {
                            focusOnText('fText');
                        })
                    }
                })
                break;
            case 'clipboardPKeySuccess':
                Toast.fire({
                    title: data.message
                });
                break;
            case 'clipboardSuccess':
                Toast.fire({
                    timer: 1000 * 10,
                    timerProgressBar: true,
                    title: data.message
                });
                break;
            case 'clipTimerCleared':
                Toast.close();
                break;
            case 'authSuccess':
                $('.lds-spinner').hide();
                $('#auth').hide();
                $('#main').show();
                $('#main #label').text(data.label);
                $('#main #pKey').text(data.pKey);
                if (data.identities.length > 0) {
                    $('#toSelf').show();
                    for (let i = 0; i < data.identities.length; i++) {
                        let note = '';
                        if (data.identities[i].ident_note) note = ' (' + data.identities[i].ident_note + ')';
                        $('#receiver').append('<option value="' + data.identities[i].ident_label + '">' + data.identities[i].ident_label + note + '</option>');
                    }
                }
                Toast.fire({
                    title: 'Signed in successfully'
                });
                break;
            case 'decryptFailed':
                Toast.fire({
                    title: data.message
                });
                break;
            case 'genFailed':
                drawAuthForm();
                Toast.fire({
                    title: data.message
                });
                openSeedToast(1000 * 3);
                break;
            case 'decrypted':
                $('#decLabel1').hide();
                $('#decLabel2').show();
                if (data.sender) {
                    $('#decInfoText').text('The encrypted message was composed ');
                    $('#composer').text('by ' + data.sender + '!');
                } else {
                    $('#decInfoText').text('The encrypted message comes from an ');
                    $('#composer').text('unknown source!');
                    Toast.fire({
                        title: 'Treat this message\nwith caution!',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: true,
                        timer: 1000 * 10,
                        timerProgressBar: true,
                        confirmButtonColor: '#ffc02d',
                        didOpen: (swal) => {
                            $(swal).find('.swal2-confirm').css({ 'color': '#000' })
                        }
                    });
                }
                $('#decMessage').val(data.decrypted);
                break;
            case 'stopIndicator':
                setIndicatior(true);
                break;
            case 'exitSuccess':
                Toast.fire({
                    title: 'Keyring closed'
                });
                $('#main').hide();
                $('#auth').show();
                break;
            default:
                break;
        }
    });

    $('#receiver').on('click', function () {
        let label = $('#receiver option:selected').val();
        if (label.includes(' ')) return
        openEdit(label);
    })

    function openEdit(label) {
        $('#cPass').hide();
        $('#gMnemonic').hide();
        $('#add').hide();
        $('#edit').show();
        $('#settings').show();

        $('#edit').text('Edit: ' + label);
    }

    $('#receiver').on('change', function () {

        $('#message').val('');
        $('#encrypted').val('');

        let label = $('#receiver option:selected').val();
        if (label.includes(' ')) {
            $('#message').prop('disabled', true);
            $('#encrypted').prop('disabled', true);
            return openSettings();
        } else {
            $('#message').prop('disabled', false);
            $('#encrypted').prop('disabled', false);
        }

        window.api.send('toMain', {
            type: 'setReceiver',
            receiver: label
        });
    })
    $('#clearEncryptView').on('click', function () {
        $('#message').val('');
        $('#encrypted').val('');
    });

    $('#clearDecryptView').on('click', function () {
        $('#encMessage').val('');
        $('#decMessage').val('');
        $('#decLabel2').hide();
        $('#decLabel1').show();
    });

    $('#clipboard').on('click', function () {
        if (!$('#encrypted').val()) return
        if (!$('#encrypted').val().includes('BEGIN SALTPACK ENCRYPTED MESSAGE')) return
        if (!$('#encrypted').val().includes('END SALTPACK ENCRYPTED MESSAGE')) return
        window.api.send('toMain', {
            type: 'clipboard',
            content: $('#encrypted').val()
        });
    });

    $('#settings').on('click', function () {
        openSettings();
    });

    function openSettings() {
        $('#settings').hide();
        $('#edit').hide();
        $('#add').show();
        $('#cPass').show();
        $('#gMnemonic').show();
    }

    $('#decryptButton').on('click', function () {

        let retN = false;
        if (!$('#encMessage').val()) return
        if (!$('#encMessage').val().includes('BEGIN SALTPACK ENCRYPTED MESSAGE')) retN = true;
        if (!$('#encMessage').val().includes('END SALTPACK ENCRYPTED MESSAGE')) retN = true;

        if (retN) return Toast.fire({
            title: 'Invalid input'
        });

        window.api.send('toMain', {
            type: 'decryptMessage',
            encMessage: $('#encMessage').val()
        });
    })

    $('#encryptViewButton').on('click', function () {

        $(this).addClass('highlight');
        $('#decryptViewButton').removeClass('highlight');
        $('#decryptView').hide();
        $('#encryptView').show();
        $('#decLabel1').hide();
        $('#decLabel2').hide();
        $('#encLabel').show();
    })

    $('#decryptViewButton').on('click', function () {

        $(this).addClass('highlight');
        $('#encryptViewButton').removeClass('highlight');
        $('#encryptView').hide();
        $('#decryptView').show();
        $('#encMessage').val('');
        $('#decMessage').val('');
        $('#encLabel').hide();
        $('#decLabel1').show();
        $('#decLabel2').hide();
    })

    $('#labelSelect').on('change', function () {
        drawAuthForm();
    })

    function drawAuthForm() {

        $('#authFormSubmit').prop('disabled', false);
        $('.lds-spinner').hide();

        let selectedText = $('#labelSelect option:selected').text();
        $('#identitiyIn').hide().prop('required', false);

        if (!selectedText.includes('keyring to')) $('#password').prop('disabled', false);

        if (!selectedText.includes(' ')) {
            $('#password').focus();
            $('#authFormSubmit').val('Load keyring: ' + selectedText);
            $('#authFormSubmit').prop('disabled', false);;
        } else {

            if (selectedText.includes('keyring')) $('#password').prop('disabled', true);
            if (selectedText.includes('new')) {
                $('#identitiyIn').val('');
                $('#identitiyIn').show().prop('required', true);
                $('#identitiyIn').focus();
                $('#authFormSubmit').val('Generate keyring: ' + $('#identitiyIn').val());
                $('#authFormSubmit').prop('disabled', false);
                return
            }
            $('#authFormSubmit').val('Load keyring');
            $('#authFormSubmit').prop('disabled', true);
        }
    }

    $('#identitiyIn').bind('input propertychange', function () {
        $('#authFormSubmit').val('Generate keyring: ' + $('#identitiyIn').val());
    })

    $('#authForm').submit(function (event) {
        event.preventDefault();
        $('#authFormSubmit').prop('disabled', true);
        $('.lds-spinner').show();
        if ($('#labelSelect').val() == 'newKeyring') {
            $('#authFormSubmit').val('Generating: ' + $('#identitiyIn').val())
            window.api.send('toMain', {
                type: 'genKeyring',
                label: $('#identitiyIn').val(),
                password: $('#password').val(),
            });
        } else {
            $('#authFormSubmit').val('Loading: ' + $('#labelSelect').val())
            window.api.send('toMain', {
                type: 'loadKeyring',
                label: $('#labelSelect option:selected').text(),
                password: $('#password').val(),
            });
        }
    });

    $('span#pKey').click(function () {
        window.api.send('toMain', {
            type: 'clipboardPKey',
            content: $('span#pKey').text()
        });
    }); 1234

    $('#cPass').click(async function () {

        let { value: formValues } = await Swal.fire({
            title: 'Change password',
            showCancelButton: true,
            html:
                '<input id="swal-input-oldPass" title="Please enter at least 8 characters" pattern=".{8,}" class="swal2-input" placeholder="current password" type="password">' +
                '<input id="swal-input-newPass" title="Please enter at least 8 characters" pattern=".{8,}" class="swal2-input" placeholder="new password" type="password">' +
                '<input id="swal-input-newPasS" title="Please enter at least 8 characters" pattern=".{8,}" class="swal2-input" placeholder="repeat password" type="password">',
            focusConfirm: false,
            didOpen: (swal) => {
                $(swal).find('.swal2-confirm').css({ 'background-color': '#ffc02d', 'color': '#000' });
                $(swal).keypress(function (e) {
                    if (e.which == 13) {
                        $(swal).find('.swal2-confirm').click();
                        return false;
                    }
                });
            },
            preConfirm: () => {
                return {
                    type: 'changePassword',
                    newPass: document.getElementById('swal-input-newPass').value,
                    oldPass: document.getElementById('swal-input-oldPass').value,
                    newPasS: document.getElementById('swal-input-newPasS').value,
                }
            }
        })
        if (formValues && formValues.newPass && formValues.newPasS && formValues.oldPass) {
            if (indicatorInterval != false) return Toast.fire({
                title: 'Please wait until the \nprevious state is saved'
            });
            setIndicatior();
            window.api.send('toMain', formValues);
        }
    });

    $('#gMnemonic').click(async function () {

        let { value: formValues } = await Swal.fire({
            title: 'Show mnemonic',
            showCancelButton: true,
            html:
                '<input id="swal-input-password" title="Please enter at least 8 characters" pattern=".{8,}" class="swal2-input" placeholder="password" type="password">',
            focusConfirm: false,
            didOpen: (swal) => {
                $(swal).find('.swal2-confirm').css({ 'background-color': '#ffc02d', 'color': '#000' });
                $('#swal-input-password').keypress(function (e) {
                    if (e.which == 13) {
                        $(swal).find('.swal2-confirm').click();
                        return false;
                    }
                });
            },
            preConfirm: () => {
                return {
                    type: 'getMnemonic',
                    password: document.getElementById('swal-input-password').value
                }
            }
        })
        if (formValues && formValues.password) window.api.send('toMain', formValues);
    })

    document.getElementById('exit').addEventListener('click', function () {
        resetEncView()
        window.api.send('toMain', {
            type: 'exit'
        });
    });

    document.getElementById('edit').addEventListener('click', async function () {

        let label = $('#receiver option:selected').val();

        let { value: formValues } = await Swal.fire({
            title: 'Edit: ' + label,
            showCancelButton: true,
            html:
                '<p class="edit"><span class="elips" id="gKey" for="swal2-publicKey" class="swal2-input-label">' + receiverKey + '</span><img src="../static/icons/clipboard.png" id="clipImage" title="copy ' + label + '\'s public key" alt="" width="25" height="25" style="margin-left:4px;"></p>' +
                '<input id="swal-input-publicKey" title="public key .{54}" pattern=".{54}" class="swal2-input" placeholder="public key ^" value="">' +
                '<p class="edit"><span class="elips" for="swal2-note" class="swal2-input-label">Current saved note:</span></p>' +
                '<input id="swal-input-note" title="[a-zA-Z0-9_]{3,16}" pattern="[a-zA-Z0-9_]{3,16}" class="swal2-input" placeholder="" value="' + receiverNote + '">',
            focusConfirm: false,
            didOpen: (swal) => {
                $(swal).find('.swal2-confirm').css({ 'background-color': '#ffc02d', 'color': '#000' });
                $(swal).find('.swal2-actions').append('<button type="button" id="delete" style="background-color: #d2452b;" class="swal2-cancel swal2-styled" aria-label="" style="display: inline-block;">Delete</button>')
                let element = $(swal).find('#swal-input-note')
                let value = element.val();
                element.focus();
                element.val('');
                element.val(value);
                $('#delete').click(function () {
                    Swal.fire({
                        title: 'Are you sure you want to delete ' + label + '\'s key?',
                        showDenyButton: true,
                        confirmButtonText: 'Delete',
                        denyButtonText: 'Abort',
                        didOpen: (swal) => {
                            $(swal).find('.swal2-confirm').css({ 'background-color': '#ffc02d', 'color': '#000' });
                        }
                    }).then((result) => {
                        if (result.isConfirmed) {
                            if (indicatorInterval != false) return Toast.fire({
                                title: 'Please wait until the \nprevious state is saved'
                            });
                            setIndicatior();
                            window.api.send('toMain', {
                                type: 'removeContact',
                                label: label
                            });
                        }
                    })
                })
                $(swal).keypress(function (e) {
                    if (e.which == 13) {
                        $(swal).find('.swal2-confirm').click();
                        return false;
                    }
                });
                $('#clipImage').click(function () {
                    window.api.send('toMain', {
                        type: 'clipboardPKey',
                        label, label,
                        content: receiverKey
                    });
                });
            },
            preConfirm: () => {
                return {
                    type: 'edit',
                    label: label,
                    key: ($('#swal-input-publicKey').val() || receiverKey),
                    note: ($('#swal-input-note').val())
                }
            }
        })
        if (formValues && formValues.label && formValues.key) {
            if (indicatorInterval != false) return Toast.fire({
                title: 'Please wait until the \nprevious state is saved'
            });
            setIndicatior();
            window.api.send('toMain', formValues);
        }
    });

    function resetEncView() {
        $('#receiver').prop('selectedIndex', 0);
        $('#message').val('');
        $('#encrypted').val('');
        $('#message').prop('disabled', true);
        $('#encrypted').prop('disabled', true);
    }

    document.getElementById('add').addEventListener('click', async function () {

        let { value: formValues } = await Swal.fire({
            title: 'Add contact',
            showCancelButton: true,
            html:
                '<input id="swal-input-label" title="[a-zA-Z0-9_]{3,16}" pattern="[a-zA-Z0-9_]{3,16}" class="swal2-input" placeholder="label">' +
                '<input id="swal-input-publicKey" title="public key .{54}" pattern=".{54}" class="swal2-input" placeholder="public key">' +
                '<input id="swal-input-note" title="[a-zA-Z0-9_]{3,16}" pattern="[a-zA-Z0-9_]{3,16}" class="swal2-input" placeholder="optional note">',
            focusConfirm: false,
            didOpen: (swal) => {

                $(swal).find('.swal2-confirm').css({ 'background-color': '#ffc02d', 'color': '#000' });
                $(swal).keypress(function (e) {
                    if (e.which == 13) {
                        $(swal).find('.swal2-confirm').click();
                        return false;
                    }
                });
            },
            preConfirm: () => {
                return {
                    type: 'addContact',
                    label: document.getElementById('swal-input-label').value,
                    key: document.getElementById('swal-input-publicKey').value,
                    note: document.getElementById('swal-input-note').value
                }
            }
        })
        if (formValues && formValues.label && formValues.key) {
            if (indicatorInterval != false) return Toast.fire({
                title: 'Please wait until the \nprevious state is saved'
            });
            setIndicatior();
            window.api.send('toMain', formValues);
        }
    });
});
