// Copyright (c) 2019 Slawomir Chodnicki
// https://medium.com/better-programming/fun-with-html-canvas-lets-create-a-star-field-a46b0fed5002

window.addEventListener("DOMContentLoaded", function(t) {
    const e = document.getElementById("canvas"),
        n = e.getContext("2d");
    let o, c;
    const i = () => {
        o = document.documentElement.clientWidth, c = document.documentElement.clientHeight, e.width = o, e.height = c
    };
    i(), window.onresize = (() => {
        i()
    });
    let l = (t => {
        const e = [];
        for (let n = 0; n < t; n++) {
            const t = {
                x: 1600 * Math.random() - 800,
                y: 900 * Math.random() - 450,
                z: 1e3 * Math.random()
            };
            e.push(t)
        }
        return e
    })(1e4);
    const r = (t, e, o) => {
        const c = 255 * o,
            i = "rgb(" + c + "," + c + "," + c + ")";
        n.fillStyle = i, n.fillRect(t, e, 1, 1)
    };
    let a;
    const d = t => {
        let i = t - a;
        a = t, (t => {
            const e = l.length;
            for (var n = 0; n < e; n++) {
                const e = l[n];
                for (e.z -= t; e.z <= 1;) e.z += 1e3
            }
        })(.1 * i), n.fillStyle = "black", n.fillRect(0, 0, e.width, e.height);
        const s = o / 2,
            m = c / 2,
            h = l.length;
        for (var u = 0; u < h; u++) {
            const t = l[u],
                e = s + t.x / (.001 * t.z),
                n = m + t.y / (.001 * t.z);
            if (e < 0 || e >= o || n < 0 || n >= c) continue;
            const i = t.z / 1e3;
            r(e, n, 1 - i * i)
        }
        requestAnimationFrame(d)
    };
    requestAnimationFrame(t => {
        a = t, requestAnimationFrame(d)
    })
});