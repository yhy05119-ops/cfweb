var PlayerAction;
(function (PlayerAction) {
    PlayerAction["Up"] = "KeyW";
    PlayerAction["Down"] = "KeyS";
    PlayerAction["Left"] = "KeyA";
    PlayerAction["Right"] = "KeyD";
    PlayerAction["CamUp"] = "ArrowUp";
    PlayerAction["CamDown"] = "ArrowDown";
    PlayerAction["CamLeft"] = "ArrowLeft";
    PlayerAction["CamRight"] = "ArrowRight";
    PlayerAction["Jump"] = "Space";
    PlayerAction["Run"] = "ShiftLeft";
    PlayerAction["Primary"] = "Mouse0";
    PlayerAction["Secondary"] = "Mouse2";
    PlayerAction["Interact"] = "KeyE";
    PlayerAction["OpenMenu"] = "KeyQ";
    PlayerAction["D1"] = "Digit1";
    PlayerAction["D2"] = "Digit2";
    PlayerAction["D3"] = "Digit3";
    PlayerAction["D4"] = "Digit4";
})(PlayerAction || (PlayerAction = {}));
var GameState;
(function (GameState) {
    GameState[GameState["MenuOpen"] = 0] = "MenuOpen";
})(GameState || (GameState = {}));
class Actions {
    static #buttonsPressedSingle = new Set();
    static #buttonsPressed = new Set();
    static gameState = new Set();
    static #invertedGA;
    static init() {
        document.onkeydown = (e) => this.#keyDown(e);
        document.onkeyup = (e) => this.#keyUp(e);
        document.onmousedown = (e) => this.#mouseDown(e);
        document.onmouseup = (e) => this.#mouseUp(e);
        window.onresize = () => this.resize();
        window.oncontextmenu = (e) => { e.preventDefault(); };
        this.#invertGA();
    }
    static #invertGA() {
        var ret = {};
        for (const key in PlayerAction) {
            ret[PlayerAction[key]] = key;
        }
        this.#invertedGA = ret;
    }
    static resize() {
        Camera.resize();
    }
    static isHeld(PA) {
        return this.#buttonsPressed.has(PA);
    }
    static isClicked(PA) {
        const res = this.#buttonsPressed.has(PA) && (!this.#buttonsPressedSingle.has(PA));
        if (res)
            this.#buttonsPressedSingle.add(PA);
        return res;
    }
    static addState(state) {
        this.gameState.add(state);
    }
    static hasState(state) {
        return this.gameState.has(state);
    }
    static deleteState(state) {
        return this.gameState.delete(state);
    }
    static #keyDown(e) {
        const action = this.#getActionFromKeyCode(e.code);
        if (action) {
            this.#buttonsPressed.add(PlayerAction[action]);
        }
    }
    static #keyUp(e) {
        const action = this.#getActionFromKeyCode(e.code);
        if (action) {
            this.#buttonsPressed.delete(PlayerAction[action]);
            this.#buttonsPressedSingle.delete(PlayerAction[action]);
        }
    }
    static #mouseDown(e) {
        e.preventDefault();
        const action = this.#getActionFromKeyCode("Mouse" + e.button);
        if (action) {
            this.#buttonsPressed.add(PlayerAction[action]);
        }
    }
    static #mouseUp(e) {
        const action = this.#getActionFromKeyCode("Mouse" + e.button);
        if (action) {
            this.#buttonsPressed.delete(PlayerAction[action]);
            this.#buttonsPressedSingle.delete(PlayerAction[action]);
        }
    }
    static #getActionFromKeyCode(code) {
        return this.#invertedGA[code];
    }
    static changeKeyBinding(gs, newKey) {
        PlayerAction[gs] = newKey;
        this.#invertGA();
    }
}
