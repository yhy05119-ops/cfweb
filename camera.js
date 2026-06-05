class Camera {
    static x = window.innerWidth / 2;
    static y = window.innerHeight / 2;
    static z = 1;
    static worldMouseX = 0;
    static worldMouseY = 0;
    static screenMouseX = 0;
    static screenMouseY = 0;
    static init() {
        window.addEventListener("mousemove", (e) => this.#handleMousePos(e));
    }
    static resize() {
    }
    static #handleMousePos(e) {
        this.screenMouseX = e.clientX;
        this.screenMouseY = e.clientY;
        this.worldMouseX = this.screenMouseX - this.x;
        this.worldMouseY = this.screenMouseY - this.y;
    }
    static update(deltaTime) {
    }
}
