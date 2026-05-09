import { Component } from '@w3d/core';
import * as THREE from 'three';
import { CollisionDetector } from './CollisionDetector.js';
import { getCameraModeManager } from '../shared/CameraModeManager.js';

/**
 * English comment.
 */
export class FirstPersonControls extends Component {
    static defaultConfig = {
        enabled: true,
        moveSpeed: 5.0,
        lookSpeed: 0.002,
        runSpeedMultiplier: 2.0,
        collision: {
            enabled: true,
            rayDistance: 1.0,
            groundDistance: 2.0,
            targets: null,
            debug: false,
            useBVH: false,
            updateRate: 60
        },
        gravity: {
            enabled: true,
            strength: 9.8,
            maxFallSpeed: 20
        },
        jump: {
            enabled: true,
            height: 2.0,
            cooldown: 500
        },
        playerBody: {
            height: 1.8,
            eyeHeight: 1.6
        },
        keys: {
            forward: ['KeyW', 'ArrowUp'],
            backward: ['KeyS', 'ArrowDown'],
            left: ['KeyA', 'ArrowLeft'],
            right: ['KeyD', 'ArrowRight'],
            jump: ['Space'],
            run: ['ShiftLeft', 'ShiftRight']
        },
        autoPointerLock: true,
        autoAdjustHeight: true,
        maxInitGroundDistance: 100,
        debugMode: false
    };

    constructor(scene, config = {}) {
        super(scene, config);

        this.camera = this.scene.camera.instance;
        this.modeManager = getCameraModeManager(this.scene);

        this.collisionDetector = null;

        this.keys = {};
        this.isPointerLocked = false;
        this.isEventsBound = false;
        this.pointerLockClickHandler = null;
        this.isActive = false;

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.tempVector = new THREE.Vector3();
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.isRunning = false;

        this.verticalVelocity = 0;
        this.isOnGround = false;
        this.lastJumpTime = 0;

        this.frameCount = 0;
        this.lastCollisionCheckTime = 0;
        this.collisionCheckInterval = this.getCollisionCheckInterval();
    }

    async onMounted() {
        await this.createCollisionDetector();
        this.euler.setFromQuaternion(this.camera.quaternion);

        if (this.config.autoAdjustHeight && this.config.gravity?.enabled && this.collisionDetector) {
            this.adjustInitialHeight();
        }

        this.modeManager?.register(this, {
            mode: 'firstPerson',
            deactivate: (reason) => this.deactivate(reason, { fromManager: true })
        });

        if (this.config.enabled !== false) {
            this.activate({ fromManager: false });
        }
    }

    onConfigUpdate() {
        this.collisionCheckInterval = this.getCollisionCheckInterval();
        this.syncCollisionDetector();

        if (this.config.enabled === false && this.isActive) {
            this.deactivate('config', { fromManager: false });
        } else if (this.config.enabled !== false && !this.isActive) {
            this.activate({ fromManager: false });
        }

        if (this.isActive) {
            if (this.config.autoPointerLock) {
                this.bindPointerLockTrigger();
            } else {
                this.unbindPointerLockTrigger();
            }
        }
    }

    setEnabled(enabled = true) {
        if (enabled) return this.activate({ fromManager: false });
        return this.deactivate('manual', { fromManager: false });
    }

    activate({ fromManager = false } = {}) {
        if (this.isActive) return true;

        if (!fromManager) {
            const accepted = this.modeManager?.requestActivate(this);
            if (accepted === false) return false;
        }

        this.isActive = true;
        this.config.enabled = true;
        this.bindEvents();
        this.bindPointerLockTrigger();
        this.emit('active-change', true);
        return true;
    }

    deactivate(reason = 'manual', { fromManager = false } = {}) {
        if (!this.isActive) {
            if (!fromManager) {
                this.modeManager?.requestDeactivate(this, reason);
            }
            return false;
        }

        this.isActive = false;
        this.config.enabled = false;
        this.unbindPointerLockTrigger();
        this.unbindEvents();
        this.resetInputState();

        if (this.isPointerLocked) {
            this.unlockPointer();
        }
        this.isPointerLocked = false;

        if (!fromManager) {
            this.modeManager?.requestDeactivate(this, reason);
        }

        this.emit('active-change', false);
        return true;
    }

    getCollisionConfig() {
        return this.config?.collision || {};
    }

    getCollisionCheckInterval() {
        const rate = Number(this.getCollisionConfig().updateRate) || 60;
        return 1000 / Math.max(1, rate);
    }

    async createCollisionDetector() {
        const collision = this.getCollisionConfig();
        if (!collision.enabled) return;

        if (this.collisionDetector) {
            this.collisionDetector.updateConfig({
                rayDistance: collision.rayDistance,
                groundDistance: collision.groundDistance,
                targets: collision.targets,
                debug: collision.debug,
                useBVH: collision.useBVH
            });
            return;
        }

        this.collisionDetector = new CollisionDetector(this.scene, {
            rayDistance: collision.rayDistance,
            groundDistance: collision.groundDistance,
            targets: collision.targets,
            debug: collision.debug,
            useBVH: collision.useBVH
        });

        if (collision.useBVH) {
            await this.collisionDetector.initializeBVH();
        }
    }

    syncCollisionDetector() {
        const collision = this.getCollisionConfig();

        if (!collision.enabled) {
            if (this.collisionDetector) {
                this.collisionDetector.dispose();
                this.collisionDetector = null;
            }
            return;
        }

        if (!this.collisionDetector) {
            this.createCollisionDetector().catch((error) => {
                // eslint-disable-next-line no-console
                console.warn('[FirstPersonControls] create collision detector failed', error);
            });
            return;
        }

        this.collisionDetector.updateConfig({
            rayDistance: collision.rayDistance,
            groundDistance: collision.groundDistance,
            targets: collision.targets,
            debug: collision.debug,
            useBVH: collision.useBVH
        });
    }

    adjustInitialHeight() {
        if (!this.collisionDetector) return;

        const currentPosition = this.camera.position.clone();
        const eyeHeight = Number(this.config.playerBody?.eyeHeight) || 1.6;
        const maxDistance = Number(this.config.maxInitGroundDistance) || 100;

        const originalGroundDistance = this.collisionDetector.config.groundDistance;
        this.collisionDetector.config.groundDistance = maxDistance;
        const groundInfo = this.collisionDetector.checkGround(currentPosition);
        this.collisionDetector.config.groundDistance = originalGroundDistance;

        if (!groundInfo || groundInfo.distance >= maxDistance) return;

        this.camera.position.y = groundInfo.point.y + eyeHeight;
        this.isOnGround = true;
        this.verticalVelocity = 0;
        this.emit('ground', true);
    }

    bindEvents() {
        if (this.isEventsBound) return;

        this.onKeyDown = this.handleKeyDown.bind(this);
        this.onKeyUp = this.handleKeyUp.bind(this);
        this.onMouseMove = this.handleMouseMove.bind(this);
        this.onPointerLockChange = this.handlePointerLockChange.bind(this);
        this.onPointerLockError = this.handlePointerLockError.bind(this);

        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('pointerlockchange', this.onPointerLockChange);
        document.addEventListener('pointerlockerror', this.onPointerLockError);
        this.isEventsBound = true;
    }

    unbindEvents() {
        if (!this.isEventsBound) return;
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('pointerlockchange', this.onPointerLockChange);
        document.removeEventListener('pointerlockerror', this.onPointerLockError);
        this.isEventsBound = false;
    }

    bindPointerLockTrigger() {
        if (!this.config.autoPointerLock || this.pointerLockClickHandler) return;
        const domElement = this.scene?.renderer?.instance?.domElement;
        if (!domElement) return;

        this.pointerLockClickHandler = () => {
            if (this.isActive) {
                this.lockPointer();
            }
        };
        domElement.addEventListener('click', this.pointerLockClickHandler);
    }

    unbindPointerLockTrigger() {
        if (!this.pointerLockClickHandler) return;
        const domElement = this.scene?.renderer?.instance?.domElement;
        if (domElement) {
            domElement.removeEventListener('click', this.pointerLockClickHandler);
        }
        this.pointerLockClickHandler = null;
    }

    lockPointer() {
        if (!this.isActive) return;
        const element = this.scene?.renderer?.instance?.domElement;
        element?.requestPointerLock?.();
    }

    unlockPointer() {
        document.exitPointerLock?.();
    }

    handlePointerLockChange() {
        const element = this.scene?.renderer?.instance?.domElement;
        this.isPointerLocked = document.pointerLockElement === element;
        this.emit('pointerlock', this.isPointerLocked);
    }

    handlePointerLockError() {
        this.emit('pointerlockerror');
    }

    handleKeyDown(event) {
        if (!this.isActive) return;
        const code = event.code;
        this.keys[code] = true;

        if (this.config.keys.forward.includes(code)) this.moveForward = true;
        if (this.config.keys.backward.includes(code)) this.moveBackward = true;
        if (this.config.keys.left.includes(code)) this.moveLeft = true;
        if (this.config.keys.right.includes(code)) this.moveRight = true;
        if (this.config.keys.run.includes(code)) this.isRunning = true;
        if (this.config.keys.jump.includes(code) && this.config.jump?.enabled) this.tryJump();
    }

    handleKeyUp(event) {
        const code = event.code;
        this.keys[code] = false;

        if (this.config.keys.forward.includes(code)) this.moveForward = false;
        if (this.config.keys.backward.includes(code)) this.moveBackward = false;
        if (this.config.keys.left.includes(code)) this.moveLeft = false;
        if (this.config.keys.right.includes(code)) this.moveRight = false;
        if (this.config.keys.run.includes(code)) this.isRunning = false;
    }

    handleMouseMove(event) {
        if (!this.isActive || !this.isPointerLocked) return;
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        this.euler.y -= movementX * this.config.lookSpeed;
        this.euler.x -= movementY * this.config.lookSpeed;
        this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
        this.camera.quaternion.setFromEuler(this.euler);
    }

    resetInputState() {
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.isRunning = false;
        this.keys = {};
    }

    tryJump() {
        const now = Date.now();
        const cooldown = Number(this.config.jump?.cooldown) || 0;
        if (!this.isOnGround || now - this.lastJumpTime <= cooldown) return;

        const gravity = Number(this.config.gravity?.strength) || 9.8;
        const height = Number(this.config.jump?.height) || 2;
        this.verticalVelocity = Math.sqrt(2 * gravity * height);
        this.isOnGround = false;
        this.lastJumpTime = now;
        this.emit('jump', { height });
    }

    updateMovement(delta) {
        const runMultiplier = Number(this.config.runSpeedMultiplier) || 2;
        const moveSpeed = Number(this.config.moveSpeed) || 5;
        const actualSpeed = this.isRunning ? moveSpeed * runMultiplier : moveSpeed;

        this.velocity.set(0, 0, 0);

        this.camera.getWorldDirection(this.direction);
        this.direction.y = 0;
        this.direction.normalize();

        const right = this.tempVector;
        right.crossVectors(this.direction, this.camera.up).normalize();

        if (this.moveForward) this.velocity.addScaledVector(this.direction, actualSpeed);
        if (this.moveBackward) this.velocity.addScaledVector(this.direction, -actualSpeed);
        if (this.moveLeft) this.velocity.addScaledVector(right, -actualSpeed);
        if (this.moveRight) this.velocity.addScaledVector(right, actualSpeed);

        if (this.velocity.lengthSq() <= 0) return;

        if (this.collisionDetector) {
            this.applyCollisionDetection(delta);
            return;
        }

        this.camera.position.x += this.velocity.x * delta;
        this.camera.position.z += this.velocity.z * delta;
    }

    applyCollisionDetection(delta) {
        const now = performance.now();
        if (now - this.lastCollisionCheckTime < this.collisionCheckInterval) {
            this.camera.position.x += this.velocity.x * delta;
            this.camera.position.z += this.velocity.z * delta;
            return;
        }
        this.lastCollisionCheckTime = now;

        const collisionCfg = this.getCollisionConfig();
        const rayDistance = Number(collisionCfg.rayDistance) || 1;

        const moveX = this.velocity.x * delta;
        const moveZ = this.velocity.z * delta;

        let canMoveX = true;
        let canMoveZ = true;

        if (Math.abs(moveX) > 0.0001) {
            const dirX = new THREE.Vector3(Math.sign(moveX), 0, 0);
            const collisionX = this.collisionDetector.checkDirection(
                this.camera.position,
                dirX,
                Math.abs(moveX) + rayDistance
            );
            if (collisionX && collisionX.distance < rayDistance) {
                canMoveX = false;
                this.emit('collision', {
                    direction: 'x',
                    object: collisionX.object,
                    point: collisionX.point,
                    distance: collisionX.distance
                });
            }
        }

        if (Math.abs(moveZ) > 0.0001) {
            const dirZ = new THREE.Vector3(0, 0, Math.sign(moveZ));
            const collisionZ = this.collisionDetector.checkDirection(
                this.camera.position,
                dirZ,
                Math.abs(moveZ) + rayDistance
            );
            if (collisionZ && collisionZ.distance < rayDistance) {
                canMoveZ = false;
                this.emit('collision', {
                    direction: 'z',
                    object: collisionZ.object,
                    point: collisionZ.point,
                    distance: collisionZ.distance
                });
            }
        }

        if (canMoveX) this.camera.position.x += moveX;
        if (canMoveZ) this.camera.position.z += moveZ;
    }

    updateGravity(delta) {
        if (!this.collisionDetector) {
            this.applyGravity(delta);
            return;
        }

        const groundCheck = this.collisionDetector.checkGround(this.camera.position);
        const threshold = 0.05;

        if (groundCheck && groundCheck.distance <= threshold) {
            this.isOnGround = true;
            this.verticalVelocity = 0;
            const eyeHeight = Number(this.config.playerBody?.eyeHeight) || 1.6;
            this.camera.position.y = groundCheck.point.y + eyeHeight;
            this.emit('ground', true);
            return;
        }

        this.isOnGround = false;
        this.applyGravity(delta);
    }

    applyGravity(delta) {
        const gravity = Number(this.config.gravity?.strength) || 9.8;
        const maxFallSpeed = Number(this.config.gravity?.maxFallSpeed) || 20;
        this.verticalVelocity -= gravity * delta;
        this.verticalVelocity = Math.max(-maxFallSpeed, this.verticalVelocity);
        this.camera.position.y += this.verticalVelocity * delta;
        this.emit('ground', false);
    }

    onUpdate(delta) {
        if (!this.isActive || !this.isPointerLocked) return;

        this.frameCount += 1;
        this.updateMovement(delta);

        if (this.config.gravity?.enabled) {
            this.updateGravity(delta);
        }

        if (this.collisionDetector && this.config.collision?.debug) {
            this.collisionDetector.updateDebugHelpers(this.camera.position);
        }
    }

    getPerformanceStats() {
        if (!this.collisionDetector) return null;
        const stats = this.collisionDetector.getPerformanceStats();
        return {
            collision: stats,
            updateRate: this.config.collision?.updateRate,
            actualUpdateInterval: this.collisionCheckInterval,
            frameCount: this.frameCount
        };
    }

    resetPerformanceStats() {
        this.collisionDetector?.resetPerformanceStats?.();
        this.frameCount = 0;
    }

    onDispose() {
        this.deactivate('dispose', { fromManager: false });
        this.modeManager?.unregister(this);

        if (this.collisionDetector) {
            this.collisionDetector.dispose();
            this.collisionDetector = null;
        }
    }
}

export default FirstPersonControls;
