import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        
        this.player = {
            mesh: null,
            velocity: new THREE.Vector3(),
            baseSpeed: 2.0,
            sprintSpeed: 5.0,
            currentSpeed: 0,
            collisionRadius: 0.4
        };

        this.animation = {
            mixer: null,
            walkAction: null,
            runAction: null, // Assuming you might have a run animation
        };

        this.cameraControls = {
            phi: 0,
            theta: -Math.PI / 4,
            distance: 5,
            target: new THREE.Vector3(),
            sensitivity: 0.006
        };

        this.input = {
            move: new THREE.Vector2(),
            look: new THREE.Vector2(),
            keys: new Set(),
            touch: {
                move: { id: null, start: new THREE.Vector2(), current: new THREE.Vector2(), joystick: null },
                look: { id: null, start: new THREE.Vector2() }
            }
        };

        this.colliders = [];
        this.clock = new THREE.Clock();
        this.isTouchDevice = 'ontouchstart' in window;

        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(this.renderer.domElement);

        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 100, 300);

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(10, 20, 5);
        this.scene.add(directionalLight);

        const groundGeo = new THREE.PlaneGeometry(500, 500);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x559020 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);

        this.loadPlayerModel();
        this.generateScenery();

        window.addEventListener('resize', this.onWindowResize.bind(this));
        this.setupControls();

        this.animate();
    }

    loadPlayerModel() {
        const loader = new FBXLoader();
        loader.load('Walking.fbx', (fbx) => {
            this.player.mesh = fbx;
            this.scene.add(this.player.mesh);

            const box = new THREE.Box3().setFromObject(this.player.mesh);
            const size = box.getSize(new THREE.Vector3());
            const scale = 1.8 / size.y;
            this.player.mesh.scale.set(scale, scale, scale);
            this.player.mesh.position.y = 0;

            this.animation.mixer = new THREE.AnimationMixer(this.player.mesh);
            if (fbx.animations.length > 0) {
                this.animation.walkAction = this.animation.mixer.clipAction(fbx.animations[0]);
                // If you have a separate run animation, you would set it up here
                // this.animation.runAction = this.animation.mixer.clipAction(fbx.animations[1]);
            } else {
                console.warn("Model loaded, but no animations found!");
            }
        }, undefined, (error) => {
            console.error('An error happened while loading the model:', error);
            document.getElementById('instructions').innerHTML = "Kunde inte ladda 3D-modellen.";
        });
    }

    generateScenery() {
        const treeCount = 100;
        const rockCount = 50;
        const mapSize = 480;
        const safeZone = 10;

        for (let i = 0; i < treeCount; i++) {
            const pos = this.getRandomPosition(mapSize, safeZone);
            const trunkHeight = Math.random() * 2 + 2;
            const trunkRadius = 0.2 + Math.random() * 0.2;
            const crownRadius = 1 + Math.random() * 0.5;
            const trunkGeo = new THREE.CylinderGeometry(trunkRadius, trunkRadius, trunkHeight);
            const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.set(pos.x, trunkHeight / 2, pos.z);
            const crownGeo = new THREE.SphereGeometry(crownRadius);
            const crownMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
            const crown = new THREE.Mesh(crownGeo, crownMat);
            crown.position.set(pos.x, trunkHeight + crownRadius * 0.8, pos.z);
            this.scene.add(trunk, crown);
            this.colliders.push({ position: pos, radius: crownRadius });
        }

        for (let i = 0; i < rockCount; i++) {
            const pos = this.getRandomPosition(mapSize, safeZone);
            const rockSize = Math.random() * 0.5 + 0.3;
            const rockGeo = new THREE.SphereGeometry(rockSize);
            const rockMat = new THREE.MeshLambertMaterial({ color: 0x808080 });
            const rock = new THREE.Mesh(rockGeo, rockMat);
            rock.position.set(pos.x, rockSize / 2, pos.z);
            this.scene.add(rock);
            this.colliders.push({ position: pos, radius: rockSize });
        }
    }

    getRandomPosition(mapSize, safeZone) {
        let x, z;
        do {
            x = Math.random() * mapSize - mapSize / 2;
            z = Math.random() * mapSize - mapSize / 2;
        } while (Math.sqrt(x*x + z*z) < safeZone);
        return new THREE.Vector3(x, 0, z);
    }

    setupControls() {
        if (this.isTouchDevice) {
            this.setupTouchControls();
            document.getElementById('desktop-instructions').style.display = 'none';
        } else {
            this.setupPointerLock();
            document.addEventListener('keydown', (e) => this.input.keys.add(e.code));
            document.addEventListener('keyup', (e) => this.input.keys.delete(e.code));
        }
    }

    setupPointerLock() {
        const canvas = this.renderer.domElement;
        canvas.addEventListener('click', () => canvas.requestPointerLock());
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === canvas) {
                document.addEventListener('mousemove', this.onMouseMove.bind(this));
                document.getElementById('instructions').style.display = 'none';
            } else {
                document.removeEventListener('mousemove', this.onMouseMove.bind(this));
                document.getElementById('instructions').style.display = 'block';
            }
        });
    }

    onMouseMove(event) {
        this.input.look.x += event.movementX * this.cameraControls.sensitivity;
        this.input.look.y += event.movementY * this.cameraControls.sensitivity;
    }

    setupTouchControls() {
        const ui = document.getElementById('ui');
        
        window.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        window.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        window.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
        window.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });
    }

    onTouchStart(event) {
        event.preventDefault();
        const touches = event.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            const isLeftSide = touch.clientX < window.innerWidth / 2;

            if (isLeftSide && this.input.touch.move.id === null) {
                // Start Movement
                const moveTouch = this.input.touch.move;
                moveTouch.id = touch.identifier;
                moveTouch.start.set(touch.clientX, touch.clientY);
                moveTouch.current.copy(moveTouch.start);
                this.createJoystick(moveTouch.start);
            } else if (!isLeftSide && this.input.touch.look.id === null) {
                // Start Look
                const lookTouch = this.input.touch.look;
                lookTouch.id = touch.identifier;
                lookTouch.start.set(touch.clientX, touch.clientY);
            }
        }
    }

    onTouchMove(event) {
        event.preventDefault();
        const touches = event.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];

            if (touch.identifier === this.input.touch.move.id) {
                // Move Joystick
                const moveTouch = this.input.touch.move;
                moveTouch.current.set(touch.clientX, touch.clientY);
                
                const diff = moveTouch.current.clone().sub(moveTouch.start);
                const maxDist = 60; // Max distance for joystick knob
                const dist = Math.min(diff.length(), maxDist);
                const angle = diff.angle();

                // Update visual joystick
                const knob = this.input.touch.move.joystick.querySelector('.joystick-inner');
                knob.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;

                // Update player input
                const inputVec = diff.normalize();
                this.input.move.set(-inputVec.x, -inputVec.y); // Invert Y for 3D space

                // Update speed based on distance
                const speedRatio = dist / maxDist;
                this.player.currentSpeed = THREE.MathUtils.lerp(this.player.baseSpeed, this.player.sprintSpeed, speedRatio);

            } else if (touch.identifier === this.input.touch.look.id) {
                // Move Look
                const lookTouch = this.input.touch.look;
                const dx = touch.clientX - lookTouch.start.x;
                const dy = touch.clientY - lookTouch.start.y;
                
                this.input.look.x -= dx * this.cameraControls.sensitivity;
                this.input.look.y += dy * this.cameraControls.sensitivity;

                lookTouch.start.set(touch.clientX, touch.clientY);
            }
        }
    }

    onTouchEnd(event) {
        event.preventDefault();
        const touches = event.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];

            if (touch.identifier === this.input.touch.move.id) {
                // End Movement
                this.input.move.set(0, 0);
                this.player.currentSpeed = 0;
                this.removeJoystick();
                this.input.touch.move.id = null;
            } else if (touch.identifier === this.input.touch.look.id) {
                // End Look
                this.input.touch.look.id = null;
            }
        }
    }
    
    createJoystick(position) {
        if (this.input.touch.move.joystick) this.removeJoystick();

        const joystick = document.createElement('div');
        joystick.id = 'joystick-left';
        joystick.className = 'joystick';
        
        const inner = document.createElement('div');
        inner.className = 'joystick-inner';
        joystick.appendChild(inner);

        document.getElementById('ui').appendChild(joystick);
        
        joystick.style.left = `${position.x - 60}px`;
        joystick.style.top = `${position.y - 60}px`;
        joystick.style.display = 'block';

        this.input.touch.move.joystick = joystick;
    }

    removeJoystick() {
        const joystick = this.input.touch.move.joystick;
        if (joystick) {
            joystick.remove();
            this.input.touch.move.joystick = null;
        }
    }

    update(deltaTime) {
        this.updateInput(deltaTime);
        if (this.player.mesh) {
            this.updatePlayer(deltaTime);
            this.updateCamera(deltaTime);
        }
        if (this.animation.mixer) {
            this.animation.mixer.update(deltaTime);
        }
    }

    updateInput(deltaTime) {
        if (!this.isTouchDevice) {
            this.input.move.set(0, 0);
            if (this.input.keys.has('KeyW')) this.input.move.y = 1;
            if (this.input.keys.has('KeyS')) this.input.move.y = -1;
            if (this.input.keys.has('KeyA')) this.input.move.x = -1;
            if (this.input.keys.has('KeyD')) this.input.move.x = 1;
            this.player.currentSpeed = this.input.keys.has('ShiftLeft') ? this.player.sprintSpeed : this.player.baseSpeed;
        }

        this.cameraControls.phi = this.input.look.y;
        this.cameraControls.theta = this.input.look.x;
        this.cameraControls.phi = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.cameraControls.phi));
    }

    updatePlayer(deltaTime) {
        if (this.input.move.lengthSq() === 0) {
            this.player.velocity.lerp(new THREE.Vector3(0,0,0), 10 * deltaTime);
        } else {
            const moveDirection = new THREE.Vector3(this.input.move.x, 0, this.input.move.y).normalize();
            
            const cameraDirection = new THREE.Vector3();
            this.camera.getWorldDirection(cameraDirection);
            const angle = Math.atan2(cameraDirection.x, cameraDirection.z);
            moveDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);

            const speed = this.isTouchDevice ? this.player.currentSpeed : (this.input.move.length() > 0 ? this.player.currentSpeed : 0);
            const targetVelocity = moveDirection.multiplyScalar(speed);
            this.player.velocity.lerp(targetVelocity, 10 * deltaTime);
        }

        const moveDelta = this.player.velocity.clone().multiplyScalar(deltaTime);
        const newPosition = this.player.mesh.position.clone().add(moveDelta);

        this.checkCollisions(newPosition);
        this.player.mesh.position.copy(newPosition);
        
        if (this.player.velocity.lengthSq() > 0.01) {
            const targetAngle = Math.atan2(this.player.velocity.x, this.player.velocity.z);
            this.player.mesh.rotation.y = THREE.MathUtils.lerp(this.player.mesh.rotation.y, targetAngle, 15 * deltaTime);
            
            // Animation handling
            const speedRatio = this.player.velocity.length() / this.player.sprintSpeed;
            if (this.animation.walkAction) {
                if (!this.animation.walkAction.isRunning()) {
                    this.animation.walkAction.play();
                }
                // This is a simple way to blend speed. A real blend tree is better.
                this.animation.walkAction.timeScale = THREE.MathUtils.lerp(0.5, 2.0, speedRatio);
            }

        } else {
            if (this.animation.walkAction && this.animation.walkAction.isRunning()) {
                this.animation.walkAction.stop();
            }
        }
    }

    checkCollisions(newPosition) {
        if (!this.player.mesh) return;
        const playerRadius = this.player.collisionRadius;
        for (const collider of this.colliders) {
            const dx = newPosition.x - collider.position.x;
            const dz = newPosition.z - collider.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            const minDistance = playerRadius + collider.radius;

            if (distance < minDistance) {
                const overlap = minDistance - distance;
                const pushVector = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(overlap);
                newPosition.add(pushVector);
            }
        }
    }

    updateCamera(deltaTime) {
        if (!this.player.mesh) return;
        this.cameraControls.target.lerp(this.player.mesh.position, 15 * deltaTime);

        const offset = new THREE.Vector3();
        offset.x = this.cameraControls.distance * Math.sin(this.cameraControls.theta) * Math.cos(this.cameraControls.phi);
        offset.y = this.cameraControls.distance * Math.sin(this.cameraControls.phi);
        offset.z = this.cameraControls.distance * Math.cos(this.cameraControls.theta) * Math.cos(this.cameraControls.phi);

        const cameraPosition = this.cameraControls.target.clone().add(offset);
        
        this.camera.position.lerp(cameraPosition, 15 * deltaTime);
        this.camera.lookAt(this.cameraControls.target.clone().add(new THREE.Vector3(0, 1, 0)));
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const deltaTime = this.clock.getDelta();
        
        this.update(deltaTime);
        this.renderer.render(this.scene, this.camera);

        const fps = 1 / deltaTime;
        document.getElementById('debug').textContent = `FPS: ${Math.round(fps)}`;
    }
}

new Game();
