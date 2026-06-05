class PlayerController {
    static x;
    static y;
    static playerSize = 40;
    static speed = 200;
    static fpsLimitBackup;
    static init() {
        this.fpsLimitBackup = Animator.FPSLimit;
    }
    static update(deltaTime) {
        if (Actions.isHeld(PlayerAction.Primary)) {
            Animator.FPSLimit = 0;
            GameManager.isDrawing = true;
        }
        else {
            Animator.FPSLimit = this.fpsLimitBackup;
        }
    }
}
