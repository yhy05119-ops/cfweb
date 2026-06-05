async function main() {
    if (!navigator.gpu) {
        throw new Error("WebGPU not supported on this browser.");
    }
    Camera.init();
    Actions.init();
    await GameManager.init();
    PlayerController.init();
    Animator.update();
}
main();
