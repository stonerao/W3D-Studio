/**
 * WeatherLighting 阴影诊断工具
 * 用于快速排查阴影不显示的问题
 */

/**
 * 诊断场景中的阴影配置
 * @param {Scene} scene - W3D场景实例
 * @param {WeatherLighting} weatherLighting - WeatherLighting组件实例
 * @returns {Object} 诊断报告
 */
export function diagnoseShadows(scene, weatherLighting) {
    const report = {
        timestamp: new Date().toISOString(),
        issues: [],
        warnings: [],
        info: [],
        recommendations: []
    };

    // 1. 检查 Renderer 阴影设置
    const renderer = scene?.renderer?.instance;
    if (!renderer) {
        report.issues.push('❌ 无法访问 WebGLRenderer 实例');
        return report;
    }

    if (!renderer.shadowMap.enabled) {
        report.issues.push('❌ WebGLRenderer.shadowMap.enabled = false（阴影总开关未启用）');
        report.recommendations.push('💡 调用 scene.renderer.enableShadow(true) 启用阴影');
    } else {
        report.info.push(`✅ WebGLRenderer.shadowMap.enabled = true`);
        report.info.push(`   shadowMap.type = ${renderer.shadowMap.type}`);
    }

    // 2. 检查 WeatherLighting 组件配置
    if (!weatherLighting) {
        report.warnings.push('⚠️  未提供 WeatherLighting 组件实例');
        return report;
    }

    const debugInfo = weatherLighting.getShadowDebugInfo();
    
    // 检查时间窗口
    if (!debugInfo.dayWindow.inDayWindow) {
        report.issues.push(`❌ 当前时段为夜间（${debugInfo.localHour.toFixed(1)}小时），太阳光已自动关闭`);
        report.recommendations.push(`💡 将 timeHour 设置为 5-20 之间（白天时段）以查看阴影效果`);
        report.recommendations.push(`   例如：weatherLighting.setTimeHour(12) // 设置为中午`);
    } else {
        report.info.push(`✅ 当前时段为白天（${debugInfo.localHour.toFixed(1)}小时）`);
    }

    // 检查太阳光配置
    if (!debugInfo.sun.castShadowConfig) {
        report.issues.push('❌ lighting.castShadow = false（配置中未启用阴影）');
        report.recommendations.push('💡 设置 lighting.castShadow = true');
    } else {
        report.info.push('✅ lighting.castShadow = true');
    }

    if (!debugInfo.sun.effectiveCastShadow) {
        report.warnings.push('⚠️  太阳光的 castShadow 实际为 false（可能因夜间自动关闭）');
    } else {
        report.info.push('✅ 太阳光 castShadow 已生效');
    }

    if (!debugInfo.sun.visible) {
        report.issues.push('❌ 太阳光不可见（visible = false）');
    } else {
        report.info.push('✅ 太阳光可见');
    }

    if (debugInfo.sun.intensity <= 0) {
        report.warnings.push(`⚠️  太阳光强度为 ${debugInfo.sun.intensity}（过低可能看不到阴影）`);
    } else {
        report.info.push(`✅ 太阳光强度 = ${debugInfo.sun.intensity.toFixed(2)}`);
    }

    // 检查阴影相机
    if (debugInfo.shadowCamera) {
        const cam = debugInfo.shadowCamera;
        const width = cam.right - cam.left;
        const height = cam.top - cam.bottom;
        report.info.push(`✅ 阴影相机范围: ${width.toFixed(0)} x ${height.toFixed(0)}`);
        report.info.push(`   left=${cam.left}, right=${cam.right}, top=${cam.top}, bottom=${cam.bottom}`);
        report.info.push(`   near=${cam.near}, far=${cam.far}`);
        
        if (width < 10 || height < 10) {
            report.warnings.push('⚠️  阴影相机范围过小，可能无法覆盖场景物体');
            report.recommendations.push('💡 使用 weatherLighting.computeShadowFit() 自动计算合适的阴影范围');
        }
    }

    // 3. 检查场景中的 Mesh
    let meshCount = 0;
    let castShadowCount = 0;
    let receiveShadowCount = 0;

    scene?.scene?.traverse?.((obj) => {
        if (obj && obj.isMesh) {
            meshCount++;
            if (obj.castShadow) castShadowCount++;
            if (obj.receiveShadow) receiveShadowCount++;
        }
    });

    report.info.push(`📊 场景统计: 共 ${meshCount} 个 Mesh`);
    report.info.push(`   - ${castShadowCount} 个启用了 castShadow（投射阴影）`);
    report.info.push(`   - ${receiveShadowCount} 个启用了 receiveShadow（接收阴影）`);

    if (meshCount === 0) {
        report.warnings.push('⚠️  场景中没有 Mesh 对象');
    } else {
        if (castShadowCount === 0) {
            report.issues.push('❌ 场景中没有 Mesh 启用 castShadow（无物体投射阴影）');
            report.recommendations.push('💡 确保 lighting.autoApplyMeshShadows = true，或手动设置 mesh.castShadow = true');
        }
        if (receiveShadowCount === 0) {
            report.issues.push('❌ 场景中没有 Mesh 启用 receiveShadow（无物体接收阴影）');
            report.recommendations.push('💡 确保 lighting.autoApplyMeshShadows = true，或手动设置 mesh.receiveShadow = true');
            report.recommendations.push('💡 或启用 shadowGround 来显示地面阴影');
        }
    }

    // 4. 检查 shadowGround
    const sgConfig = weatherLighting.config?.lighting?.shadowGround;
    if (sgConfig?.enabled) {
        report.info.push('✅ shadowGround（阴影接收地面）已启用');
    } else {
        report.warnings.push('⚠️  shadowGround 未启用，可能看不到明显的阴影效果');
        report.recommendations.push('💡 启用 lighting.shadowGround.enabled = true 以显示地面阴影');
    }

    return report;
}

/**
 * 打印诊断报告到控制台
 * @param {Object} report - 诊断报告
 */
export function printDiagnosticReport(report) {
    console.group('🔍 WeatherLighting 阴影诊断报告');
    console.log('时间:', report.timestamp);
    console.log('');

    if (report.issues.length > 0) {
        console.group('❌ 问题 (' + report.issues.length + ')');
        report.issues.forEach(issue => console.log(issue));
        console.groupEnd();
        console.log('');
    }

    if (report.warnings.length > 0) {
        console.group('⚠️  警告 (' + report.warnings.length + ')');
        report.warnings.forEach(warning => console.log(warning));
        console.groupEnd();
        console.log('');
    }

    if (report.info.length > 0) {
        console.group('ℹ️  信息');
        report.info.forEach(info => console.log(info));
        console.groupEnd();
        console.log('');
    }

    if (report.recommendations.length > 0) {
        console.group('💡 建议 (' + report.recommendations.length + ')');
        report.recommendations.forEach(rec => console.log(rec));
        console.groupEnd();
    }

    console.groupEnd();
}

