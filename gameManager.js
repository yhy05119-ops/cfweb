class GameManager {
    static canvas;
    static WIDTH = 512;
    static HEIGHT = 256;
    static adapter;
    static device;
    static context;
    static presentationFormat;
    static shaderModule;
    static uniformBuffer;
    static computeBindGroupLayout;
    static renderBindGroupLayout;
    static computeBindGroupA;
    static computeBindGroupB;
    static renderBindGroupA;
    static renderBindGroupB;
    static renderPipeline;
    static computePipeline;
    static step = 0;
    static uniformBufferPaint;
    static isDrawing = false;
    static computePipelineDraw;
    static computeBindGroupLayoutDraw;
    static computeBindGroupDrawA;
    static computeBindGroupDrawB;
    static async init() {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
        if (!adapter) {
            throw new Error("No appropriate GPUAdapter found.");
        }
        this.adapter = adapter;
        this.device = await adapter.requestDevice();
        this.canvas = document.getElementById("gameCanvas");
        this.canvas.width = this.WIDTH;
        this.canvas.height = this.HEIGHT;
        this.context = this.canvas.getContext("webgpu");
        this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: this.presentationFormat,
        });
        this.shaderModule = this.device.createShaderModule({
            code: await this.#getShaderCode('./shaders/GOL.wgsl'),
        });
        this.uniformBuffer = this.device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.uniformBuffer, 0, new Uint32Array([this.WIDTH, this.HEIGHT]));
        this.uniformBufferPaint = this.device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.uniformBufferPaint, 0, new Uint32Array([0, 0]));
        const cellStateSize = this.WIDTH * this.HEIGHT * Uint32Array.BYTES_PER_ELEMENT;
        const cellStateStorage = new Uint32Array(this.WIDTH * this.HEIGHT);
        for (let i = 0; i < cellStateStorage.length; i++) {
            cellStateStorage[i] = Math.random() > 0.3 ? 1 : 0;
        }
        const cellStateBufferA = this.device.createBuffer({
            size: cellStateSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        const cellStateBufferB = this.device.createBuffer({
            size: cellStateSize,
            usage: GPUBufferUsage.STORAGE,
        });
        this.device.queue.writeBuffer(cellStateBufferA, 0, cellStateStorage);
        this.computePipeline = this.device.createComputePipeline({
            layout: "auto",
            compute: {
                module: this.shaderModule,
                entryPoint: "computeMain",
            },
        });
        this.computePipelineDraw = this.device.createComputePipeline({
            layout: "auto",
            compute: {
                module: this.shaderModule,
                entryPoint: "computeDraw",
            },
        });
        this.renderPipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: this.shaderModule,
                entryPoint: "vertexMain",
            },
            fragment: {
                module: this.shaderModule,
                entryPoint: "fragmentMain",
                targets: [{ format: this.presentationFormat }],
            },
            primitive: {
                topology: "triangle-list",
            },
        });
        this.computeBindGroupLayout = this.computePipeline.getBindGroupLayout(0);
        this.computeBindGroupLayoutDraw = this.computePipelineDraw.getBindGroupLayout(0);
        this.renderBindGroupLayout = this.renderPipeline.getBindGroupLayout(0);
        this.computeBindGroupA = this.device.createBindGroup({
            layout: this.computeBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 2, resource: { buffer: cellStateBufferA } },
                { binding: 3, resource: { buffer: cellStateBufferB } },
            ],
        });
        this.computeBindGroupB = this.device.createBindGroup({
            layout: this.computeBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 2, resource: { buffer: cellStateBufferB } },
                { binding: 3, resource: { buffer: cellStateBufferA } },
            ],
        });
        this.computeBindGroupDrawA = this.device.createBindGroup({
            layout: this.computeBindGroupLayoutDraw,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: { buffer: this.uniformBufferPaint } },
                { binding: 3, resource: { buffer: cellStateBufferB } },
            ],
        });
        this.computeBindGroupDrawB = this.device.createBindGroup({
            layout: this.computeBindGroupLayoutDraw,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: { buffer: this.uniformBufferPaint } },
                { binding: 3, resource: { buffer: cellStateBufferA } },
            ],
        });
        this.renderBindGroupA = this.device.createBindGroup({
            layout: this.renderBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 2, resource: { buffer: cellStateBufferA } },
            ],
        });
        this.renderBindGroupB = this.device.createBindGroup({
            layout: this.renderBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 2, resource: { buffer: cellStateBufferB } },
            ],
        });
    }
    static async #getShaderCode(dir) {
        const response = await fetch(dir);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    }
    static updatePhysics(deltaTime) {
        const commandEncoder = this.device.createCommandEncoder();
        if (!this.isDrawing) {
            const computePass = commandEncoder.beginComputePass();
            computePass.setPipeline(this.computePipeline);
            computePass.setBindGroup(0, this.step % 2 === 0 ? this.computeBindGroupA : this.computeBindGroupB);
            computePass.dispatchWorkgroups(Math.ceil(this.WIDTH / 8), Math.ceil(this.HEIGHT / 8));
            computePass.end();
        }
        else {
            const xcord = Math.floor(Camera.screenMouseX / this.canvas.getBoundingClientRect().width * this.WIDTH);
            const ycord = Math.floor(Camera.screenMouseY / this.canvas.getBoundingClientRect().height * this.HEIGHT);
            this.device.queue.writeBuffer(this.uniformBufferPaint, 0, new Uint32Array([xcord, ycord]));
            const computePass = commandEncoder.beginComputePass();
            computePass.setPipeline(this.computePipelineDraw);
            computePass.setBindGroup(0, this.step % 2 === 1 ? this.computeBindGroupDrawA : this.computeBindGroupDrawB);
            computePass.dispatchWorkgroups(1);
            computePass.end();
            this.isDrawing = false;
            this.step++;
        }
        const renderPassDescriptor = {
            colorAttachments: [
                {
                    view: this.context.getCurrentTexture().createView(),
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        };
        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
        renderPass.setPipeline(this.renderPipeline);
        renderPass.setBindGroup(0, this.step % 2 === 0 ? this.renderBindGroupB : this.renderBindGroupA);
        renderPass.draw(6);
        renderPass.end();
        this.device.queue.submit([commandEncoder.finish()]);
        this.step++;
    }
}
