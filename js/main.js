import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * 自动缩放模型到目标尺寸（最大维度）
 */
function autoScaleModel(model, targetSize = 2) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim === 0) return;
    const scale = targetSize / maxDim;
    model.scale.set(scale, scale, scale);
    console.log(`✅ 缩放: 原始最大维度 ${maxDim.toFixed(4)} → ${(maxDim * scale).toFixed(4)} (因子 ${scale.toFixed(4)})`);
    return scale;
}

/**
 * 增强材质可见性（保留纹理，双面渲染，轻微自发光）
 */
function enhanceMaterialVisibility(model) {
    let meshCount = 0;
    model.traverse(child => {
        if (child.isMesh) {
            meshCount++;
            const mat = child.material;
            if (mat) {
                const materials = Array.isArray(mat) ? mat : [mat];
                materials.forEach(m => {
                    // 不创建新材质，直接修改原材质属性，保留所有纹理通道
                    m.side = THREE.DoubleSide;  // 双面渲染
                    // 增加自发光，避免过暗
                    if (!m.emissive) m.emissive = new THREE.Color(0x222222);
                    m.emissiveIntensity = 0.3;
                    // 如果材质颜色为纯黑且没有纹理，给一个基础色，否则保留原色
                    if (m.color && m.color.getHex() === 0x000000 && !m.map) {
                        m.color.setHex(0xccaa66);
                    }
                    // 微调粗糙度和金属度，增强可见性（可选）
                    if (m.roughness !== undefined) m.roughness = Math.min(m.roughness, 0.7);
                    if (m.metalness !== undefined) m.metalness = Math.min(m.metalness, 0.3);
                });
            }
        }
    });
    console.log(`✅ 增强 ${meshCount} 个网格材质（保留纹理）`);
    return meshCount;
}

/* ========== 背景场景 ========== */
function initHeroBackground() {
    let container = document.getElementById('hero-3d-background');
    if (!container) {
        container = document.createElement('div');
        container.id = 'hero-3d-background';
        document.body.insertBefore(container, document.body.firstChild);
    }

    const navbar = document.querySelector('.navbar');
    const hero = document.querySelector('.hero');
    const updateSize = () => {
        const height = navbar.offsetHeight + hero.offsetHeight;
        container.style.height = height + 'px';
        if (renderer) renderer.setSize(container.clientWidth, height);
        if (camera) camera.aspect = container.clientWidth / height;
        if (camera) camera.updateProjectionMatrix();
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1030);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    // 手动设置相机位置（固定）
    camera.position.set(5, 3, 8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, 1);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // 灯光系统
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);
    const mainLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    mainLight.position.set(2, 3, 2);
    scene.add(mainLight);
    const fillLight = new THREE.DirectionalLight(0xaaccff, 0.6);
    fillLight.position.set(-1, 1, -1);
    scene.add(fillLight);
    const backLight = new THREE.PointLight(0xffaa66, 0.5);
    backLight.position.set(0, 1, -2);
    scene.add(backLight);

    // 星空粒子
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 800;
    const starsPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount; i++) {
        starsPositions[i*3] = (Math.random() - 0.5) * 200;
        starsPositions[i*3+1] = (Math.random() - 0.5) * 100;
        starsPositions[i*3+2] = (Math.random() - 0.5) * 80 - 40;
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.08 });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    let modelMixer = null;
    let model = null;

    const loader = new GLTFLoader();
    loader.load('models/scene.glb', (gltf) => {
        model = gltf.scene;
        scene.add(model);
        console.log('📦 背景模型加载成功');

        enhanceMaterialVisibility(model);
        autoScaleModel(model, 300.0);

        // 居中模型
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.x -= center.x;
        model.position.y -= center.y;
        model.position.z -= center.z;
        console.log('📐 模型包围盒尺寸:', box.getSize(new THREE.Vector3()));

        // 向右移动模型（正 X 方向），相机不动
        model.position.x += -40.0;  // 可根据需要调整数值
        model.position.y += -2.0;
        // 👇 让模型靠近相机（Z 轴正方向）
        model.position.z += 100;   // 数值越大，离相机越近

        // 👇 添加旋转：向左转90度（顺时针）
        model.rotation.y = -Math.PI / 6;

        // 可选：调整模型旋转（如需，取消注释）
        // model.rotation.y = Math.PI / 2;

        // 模型动画
        if (gltf.animations && gltf.animations.length) {
            modelMixer = new THREE.AnimationMixer(model);
            gltf.animations.forEach(clip => {
                modelMixer.clipAction(clip).play();
            });
            console.log(`🎬 模型动画已启动 (${gltf.animations.length} 个剪辑)`);
        }

        // 动画循环
        let clock = new THREE.Clock();
        function animate() {
            requestAnimationFrame(animate);
            const delta = clock.getDelta();
            if (modelMixer) modelMixer.update(delta);
            stars.rotation.y += 0.0005;
            renderer.render(scene, camera);
        }
        animate();

        console.log('✅ 背景场景初始化完成，相机固定，模型已右移');
    }, undefined, (error) => {
        console.error('❌ 背景模型加载失败:', error);
    });

    window.addEventListener('resize', updateSize);
    updateSize();
}

function initCard3D() {
    const card = document.getElementById('owl-card-3d');
    if (!card) {
        console.error('❌ 未找到卡片容器 #owl-card-3d');
        return;
    }

    // 清除已存在的 canvas
    const existingCanvas = card.querySelector('.card-3d-canvas');
    if (existingCanvas) existingCanvas.remove();

    const canvasWrapper = document.createElement('div');
    canvasWrapper.className = 'card-3d-canvas';
    card.appendChild(canvasWrapper);

    const scene = new THREE.Scene();
    scene.background = null;

    // ========== 添加星空背景（粒子系统） ==========
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 600;
    const starsPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount; i++) {
        // 粒子分布在较大范围内，深度在 -20 到 -5 之间，确保在模型后方
        starsPositions[i*3] = (Math.random() - 0.5) * 30;
        starsPositions[i*3+1] = (Math.random() - 0.5) * 20;
        starsPositions[i*3+2] = (Math.random() - 0.5) * 15 - 15; // Z 轴负方向（相机后方）
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.08 });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
    // ============================================

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(card.clientWidth, card.clientHeight);
    renderer.setClearColor(0x000000, 0);
    canvasWrapper.appendChild(renderer.domElement);

    // 仅保留一个微弱的环境光，让自发光材质更明显
    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambient);

    let mixer = null;
    let model = null;
    let animationPlaying = false;

    const loader = new GLTFLoader();
    loader.load('models/card_model.glb', (gltf) => {
        model = gltf.scene;
        scene.add(model);
        console.log('📦 卡片模型加载成功');

        // 强制更新矩阵，确保包围盒计算正确
        model.updateMatrixWorld(true);

        // 设置材质：双面渲染 + 高自发光（让模型自身发光，不依赖光源）
        model.traverse(child => {
            if (child.isMesh) {
                const mat = child.material;
                if (mat) {
                    // 双面渲染，避免背面黑
                    mat.side = THREE.DoubleSide;
                    // 设置自发光颜色（亮橙色/米色，可根据纹理调整）
                    if (!mat.emissive) mat.emissive = new THREE.Color(0xccaa66);
                    mat.emissiveIntensity = 1.0;  // 较高自发光强度，确保可见
                    // 如果材质颜色纯黑且没有纹理，给一个基础色
                    if (mat.color && mat.color.getHex() === 0x000000 && !mat.map) {
                        mat.color.setHex(0xccaa66);
                    }
                    // 可适当降低粗糙度和金属度，让材质更亮
                    if (mat.roughness !== undefined) mat.roughness = 0.3;
                    if (mat.metalness !== undefined) mat.metalness = 0.1;
                }
            }
        });

        // 计算包围盒并居中模型
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        model.position.x -= center.x;
        model.position.y -= center.y;
        model.position.z -= center.z;
        console.log('📐 模型包围盒尺寸:', size);

        // 根据模型大小自动调整相机距离
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
            let distance = maxDim / (2 * Math.tan(camera.fov * Math.PI / 360));
            distance *= 1.2;
            camera.position.set(0.8, 0.2, distance);
            camera.lookAt(0, 0, 0);
            console.log(`📷 相机距离已设为 ${distance.toFixed(2)}，模型最大维度 ${maxDim.toFixed(2)}`);
        } else {
            console.warn('⚠️ 模型包围盒尺寸为0，使用默认相机距离');
            camera.position.set(0, 0, 2);
        }

        // 可选：旋转模型，使正面朝向相机（根据需要调整）
        // model.rotation.y = -Math.PI / 2;

        // 创建动画混合器，初始暂停
        if (gltf.animations && gltf.animations.length) {
            mixer = new THREE.AnimationMixer(model);
            gltf.animations.forEach(clip => {
                const action = mixer.clipAction(clip);
                action.paused = true;
            });
            console.log(`🎬 卡片动画已加载 (${gltf.animations.length} 个剪辑)，等待鼠标悬停触发`);
        } else {
            console.log('ℹ️ 卡片模型无动画');
        }

        // 鼠标悬停控制动画
        const startAnimation = () => {
            if (mixer && !animationPlaying) {
                gltf.animations.forEach(clip => {
                    const action = mixer.clipAction(clip);
                    action.paused = false;
                    action.play();
                });
                animationPlaying = true;
                console.log('🎬 卡片动画播放');
            }
        };

        const stopAnimation = () => {
            if (mixer && animationPlaying) {
                gltf.animations.forEach(clip => {
                    const action = mixer.clipAction(clip);
                    action.paused = true;
                    action.stop();
                });
                animationPlaying = false;
                console.log('⏸️ 卡片动画停止');
            }
        };

        card.addEventListener('mouseenter', startAnimation);
        card.addEventListener('mouseleave', stopAnimation);

        // 动画循环
        let clock = new THREE.Clock();
        function animateCard() {
            requestAnimationFrame(animateCard);
            const delta = clock.getDelta();
            if (mixer) mixer.update(delta);

            // 让星空缓慢旋转，增加动感
            stars.rotation.y += 0.0005;

            const width = card.clientWidth;
            const height = card.clientHeight;
            if (width && height && (width !== renderer.domElement.width || height !== renderer.domElement.height)) {
                renderer.setSize(width, height);
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
            }
            renderer.render(scene, camera);
        }
        animateCard();

        console.log('✅ 卡片场景初始化完成（自发光材质 + 星空背景）');
    }, undefined, (error) => {
        console.error('❌ 卡片模型加载失败:', error);
    });

    window.addEventListener('resize', () => {
        if (card.clientWidth && card.clientHeight) {
            renderer.setSize(card.clientWidth, card.clientHeight);
            camera.aspect = card.clientWidth / card.clientHeight;
            camera.updateProjectionMatrix();
        }
    });
}

/* ========== 鼠标光晕 ========== */
document.addEventListener('mousemove', (e) => {
    const glow = document.querySelector('.mouse-glow');
    if (glow) {
        glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    }
});

/* ========== 计数器动画 ========== */
function startCounter(selector, targetNum, duration = 2000) {
    const element = document.querySelector(selector);
    if (!element) return;
    let started = false;
    const updateCounter = () => {
        if (started) return;
        const rect = element.getBoundingClientRect();
        if (rect.top < window.innerHeight - 100) {
            started = true;
            let start = 0;
            const step = Math.ceil(targetNum / (duration / 16));
            const timer = setInterval(() => {
                start += step;
                if (start >= targetNum) {
                    start = targetNum;
                    clearInterval(timer);
                }
                element.innerText = start;
            }, 16);
        }
    };
    window.addEventListener('scroll', updateCounter);
    updateCounter();
}

/* ========== 启动 ========== */
document.addEventListener('DOMContentLoaded', () => {
    initHeroBackground();
    initCard3D();
    startCounter('.counter-num', 200, 1500);
});

// ===== 滚动淡入淡出效果（卡片及下方区域） =====
// 在 DOMContentLoaded 事件内添加（与现有代码共存）
document.addEventListener('DOMContentLoaded', () => {
    // 选择需要添加淡入效果的元素：卡片区域、科普块、号召横幅、页脚
    const fadeElements = document.querySelectorAll(
        '.features-section, .info-block, .future-banner, .footer'
    );
    
    if (!fadeElements.length) return;
    
    // 为每个目标元素添加基础淡入类（初始隐藏）
    fadeElements.forEach(el => {
        el.classList.add('fade-section');
    });
    
    // 创建 Intersection Observer 监听元素进入视口
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // 当元素进入视口（至少 15% 可见）时添加 visible 类
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // 添加 visible 后停止监听该元素，避免重复触发
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15,      // 元素 15% 可见时触发
        rootMargin: '0px 0px -30px 0px'  // 微调触发时机，让效果更自然
    });
    
    // 开始观察所有目标元素
    fadeElements.forEach(el => {
        observer.observe(el);
    });
    
    // 额外处理：如果某些元素在页面加载时已经可见（例如首屏卡片区域）
    // 手动触发一次快速检查，确保立即显示
    setTimeout(() => {
        fadeElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const windowHeight = window.innerHeight || document.documentElement.clientHeight;
            // 如果元素顶部在视口内且尚未添加 visible 类，则手动触发
            if (rect.top < windowHeight - 100 && !el.classList.contains('visible')) {
                el.classList.add('visible');
                observer.unobserve(el);
            }
        });
    }, 200);
});

