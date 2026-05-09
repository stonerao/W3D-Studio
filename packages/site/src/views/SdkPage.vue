<script setup>
import { ref } from 'vue'

const activeTab = ref('quick')
</script>

<template>
    <section class="section" style="margin-top: 0">
        <h2>SDK 使用说明</h2>
        <p>W3D SDK 基于 Three.js 封装，目标是让业务团队用最短路径把三维能力接进项目里——不用自己处理渲染循环、资源管理和事件拾取这些底层工作。</p>
    </section>

    <!-- English comment. -->
    <section class="section">
        <h2>用法</h2>
        <div class="tabs">
            <button class="tab-btn" :class="{ active: activeTab === 'quick' }" @click="activeTab = 'quick'">快速上手</button>
            <button class="tab-btn" :class="{ active: activeTab === 'component' }" @click="activeTab = 'component'">自定义组件</button>
            <button class="tab-btn" :class="{ active: activeTab === 'event' }" @click="activeTab = 'event'">事件与交互</button>
            <button class="tab-btn" :class="{ active: activeTab === 'anim' }" @click="activeTab = 'anim'">动画</button>
        </div>

        <!-- English comment. -->
        <div v-show="activeTab === 'quick'">
            <div class="code-block">
                <pre><span class="kw">import</span> { <span class="fn">Scene</span> } <span class="kw">from</span> <span class="str">'@w3d/core'</span>

<span class="kw">const</span> scene = <span class="kw">new</span> <span class="fn">Scene</span>(<span class="str">'#app'</span>, {
    renderer: { antialias: <span class="kw">true</span> },
    camera:   { fov: <span class="num">45</span>, position: [<span class="num">0</span>, <span class="num">100</span>, <span class="num">200</span>] },
    controls: { enableDamping: <span class="kw">true</span> }
})
scene.<span class="fn">init</span>()

<span class="cm">// English comment.
scene.light.<span class="fn">addAmbient</span>({ intensity: <span class="num">0.8</span> })
scene.light.<span class="fn">addDirectional</span>({
    position: [<span class="num">100</span>, <span class="num">100</span>, <span class="num">100</span>],
    castShadow: <span class="kw">true</span>
})

<span class="cm">// English comment.
<span class="kw">const</span> model = <span class="kw">await</span> scene.<span class="fn">add</span>(<span class="str">'ModelLoader'</span>, {
    name: <span class="str">'robot'</span>,
    url:  <span class="str">'/models/robot.glb'</span>,
    scale: <span class="num">2</span>
})

<span class="cm">// English comment.
model.<span class="fn">on</span>(<span class="str">'click'</span>, (e) => console.log(<span class="str">'hit'</span>, e.object))</pre>
            </div>
        </div>

        <!-- English comment. -->
        <div v-show="activeTab === 'component'">
            <p>所有 3D 对象都继承 <code>Component</code>（本身是 THREE.Group），拥有统一的生命周期：</p>
            <p><code>onCreate → onBeforeMount → onMounted → onUpdate(delta) → onBeforeDispose → onDispose</code></p>
            <div class="code-block">
                <pre><span class="kw">import</span> { <span class="fn">Component</span> } <span class="kw">from</span> <span class="str">'@w3d/core'</span>
<span class="kw">import</span> * <span class="kw">as</span> THREE <span class="kw">from</span> <span class="str">'three'</span>

<span class="kw">class</span> <span class="fn">RotatingBox</span> <span class="kw">extends</span> <span class="fn">Component</span> {
    <span class="kw">static</span> defaultConfig = { color: <span class="str">'#00ff00'</span>, size: <span class="num">1</span> }

    <span class="fn">onCreate</span>() {
        <span class="kw">const</span> geo = <span class="kw">new</span> THREE.<span class="fn">BoxGeometry</span>(<span class="kw">this</span>.config.size, <span class="kw">this</span>.config.size, <span class="kw">this</span>.config.size)
        <span class="kw">const</span> mat = <span class="kw">new</span> THREE.<span class="fn">MeshStandardMaterial</span>({ color: <span class="kw">this</span>.config.color })
        <span class="kw">this</span>.mesh = <span class="kw">new</span> THREE.<span class="fn">Mesh</span>(geo, mat)
        <span class="kw">this</span>.<span class="fn">add</span>(<span class="kw">this</span>.mesh)
    }

    <span class="fn">onUpdate</span>(delta) { <span class="kw">this</span>.mesh.rotation.y += delta }

    <span class="fn">getInteractiveObjects</span>() { <span class="kw">return</span> [<span class="kw">this</span>.mesh] }

    <span class="fn">onDispose</span>() {
        <span class="kw">this</span>.mesh.geometry.<span class="fn">dispose</span>()
        <span class="kw">this</span>.mesh.material.<span class="fn">dispose</span>()
    }
}

scene.<span class="fn">registerComponent</span>(<span class="str">'RotatingBox'</span>, RotatingBox)
<span class="kw">await</span> scene.<span class="fn">add</span>(<span class="str">'RotatingBox'</span>, { color: <span class="str">'#ff0000'</span>, size: <span class="num">2</span> })</pre>
            </div>
        </div>

        <!-- English comment. -->
        <div v-show="activeTab === 'event'">
            <p>组件实现 <code>getInteractiveObjects()</code> 后即可接收鼠标事件，无需手动做射线检测。</p>
            <div class="code-block">
                <pre><span class="cm">// English comment.
model.<span class="fn">on</span>(<span class="str">'click'</span>,      (e) => { <span class="cm">/* e.object, e.point */</span> })
model.<span class="fn">on</span>(<span class="str">'mouseenter'</span>, (e) => { e.object.material.emissive.<span class="fn">set</span>(<span class="str">'#ffff00'</span>) })
model.<span class="fn">on</span>(<span class="str">'mouseleave'</span>, (e) => { e.object.material.emissive.<span class="fn">set</span>(<span class="str">'#000000'</span>) })

<span class="cm">// English comment.
scene.eventSystem.<span class="fn">on</span>(<span class="str">'click'</span>, (e) => console.log(e.point))

<span class="cm">// English comment.
component.<span class="fn">emit</span>(<span class="str">'alarm'</span>, { level: <span class="str">'critical'</span> })
component.<span class="fn">on</span>(<span class="str">'alarm'</span>, (data) => { <span class="cm">/* ... */</span> })</pre>
            </div>
        </div>

        <!-- English comment. -->
        <div v-show="activeTab === 'anim'">
            <p>两种方式：模型自带动画走 AnimationManager，代码驱动走 Tween。</p>
            <div class="code-block">
                <pre><span class="kw">import</span> { <span class="fn">Tween</span> } <span class="kw">from</span> <span class="str">'@w3d/core'</span>

<span class="cm">// English comment.
<span class="fn">Tween</span>.<span class="fn">to</span>(model.position, { y: <span class="num">10</span> }, <span class="num">2000</span>, {
    easing: <span class="str">'easeInOutQuad'</span>,
    onComplete: () => console.log(<span class="str">'done'</span>)
})

<span class="cm">// English comment.
scene.animationManager.<span class="fn">play</span>(gltf.scene, gltf.animations[<span class="num">0</span>], {
    loop: THREE.LoopRepeat,
    timeScale: <span class="num">1.0</span>
})</pre>
            </div>
        </div>
    </section>

    <!-- English comment. -->
    <section class="section">
        <h2>核心模块</h2>
        <table class="api-table">
            <thead>
                <tr><th>模块</th><th>包名</th><th>职责</th></tr>
            </thead>
            <tbody>
                <tr><td>渲染引擎</td><td><code>@w3d/core</code></td><td>Scene、Renderer、Camera、Controls、Light、EventSystem、ResourceManager、AnimationManager</td></tr>
                <tr><td>组件库</td><td><code>@w3d/components</code></td><td>ModelLoader、HDRLoader、DXFLoader、Label3D、Pipeline、Ocean、Weather 等 20+ 组件</td></tr>
                <tr><td>工具集</td><td><code>@w3d/utils</code></td><td>数学工具、颜色转换、坐标变换等通用函数</td></tr>
            </tbody>
        </table>
    </section>

    <!-- English comment. -->
    <section class="section">
        <h2>Scene 配置速查</h2>
        <table class="api-table">
            <thead>
                <tr><th>参数</th><th>类型</th><th>默认值</th><th>说明</th></tr>
            </thead>
            <tbody>
                <tr><td><code>renderer.antialias</code></td><td>boolean</td><td>false</td><td>抗锯齿</td></tr>
                <tr><td><code>renderer.alpha</code></td><td>boolean</td><td>false</td><td>透明背景</td></tr>
                <tr><td><code>camera.fov</code></td><td>number</td><td>45</td><td>视野角度</td></tr>
                <tr><td><code>camera.position</code></td><td>[x, y, z]</td><td>[0, 0, 10]</td><td>相机位置</td></tr>
                <tr><td><code>camera.near / far</code></td><td>number</td><td>0.1 / 10000</td><td>裁剪面</td></tr>
                <tr><td><code>controls.enableDamping</code></td><td>boolean</td><td>true</td><td>阻尼</td></tr>
                <tr><td><code>controls.autoRotate</code></td><td>boolean</td><td>false</td><td>自动旋转</td></tr>
            </tbody>
        </table>
    </section>

    <!-- English comment. -->
    <section class="section">
        <h2>最佳实践</h2>
        <ul class="feature-list">
            <li>及时调用 <code>scene.remove(name)</code> 销毁不用的组件，避免内存泄漏。</li>
            <li>在 <code>onDispose()</code> 里释放 geometry、material 和 texture。</li>
            <li>不要在 <code>onUpdate()</code> 里做复杂计算，可用节流或缓存策略。</li>
            <li>推荐 GLTF/GLB 格式——体积小、加载快、支持 PBR 和动画。</li>
            <li>合理设置 camera near/far，避免精度问题和不必要的渲染开销。</li>
            <li>用 <code>scene.resourceManager.getStats()</code> 随时查看资源加载状态。</li>
        </ul>
    </section>
</template>
