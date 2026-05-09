/*
 * @Description: 路径流光组件shader文件
 * @Author:
 * @Date: 2021-12-31 09:40:06
 */
const PATH_SHADER = {
    vertexShader: `
        // uniform vec4 uColor;
        uniform float uScale;
        uniform bool uAutoSize;
        // attribute float cIndex;
        attribute vec3 cBevels;
        // varying vec4 vColor;
        varying vec2 vUv;
        // varying float vIndex;
        void main() {
            vUv = uv;
            // vColor = uColor;
            // vIndex = cIndex;

            vec3 pos = position;
            if(!uAutoSize){
                // pos += cBevels * uScale;
                pos = pos - cBevels +  cBevels * uScale;
                // pos = pos;
            }

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    // 路径流光 占比
    fragmentShader1: `
    uniform float uTime;
    uniform sampler2D uTxue;
    uniform sampler2D uBgTxue;
    uniform float uOpacity;
    uniform float uSpeed;
    uniform vec4 uColor;
    uniform bool uIsTxue;
    uniform vec2 uRepeat;
    uniform vec4 uBgColor;
    uniform vec2 uBgRepeat;
    uniform bool uIsBgTxue;
    uniform bool uLoop;
    uniform float uRadio;
    uniform bool uIsFade;

    varying vec2 vUv;
        void main() {
            vec4 lColor = uColor;
            vec4 bgColor = uBgColor;

            if(vUv.x >= uTime - uRadio && vUv.x <= uTime){
                if(uIsTxue){
                    lColor *= texture2D(uTxue, vec2((1. - uTime + vUv.x) * uRepeat.x, vUv.y * uRepeat.y));
                }
            }else {
                lColor.w = 0.;
            }

            // 背景
            if(uIsBgTxue){
                bgColor *= texture2D(uBgTxue , vUv * uBgRepeat);
            }

            // 首尾透明
            if(uIsFade && vUv.x <=0.1){
                lColor.w *= vUv.x * 10.;
            }else if(uIsFade && vUv.x >=0.9){
                lColor.w *= (1. - vUv.x) * 10.;
            }

            float F = lColor.w + bgColor.w * (1. - lColor.w);
            gl_FragColor = (lColor * lColor.w + bgColor * bgColor.w * (1. - lColor.w)) / F;
            gl_FragColor.w *= uOpacity;
        }
    `,
    // 路径填充效果
    fragmentShader2: `
        uniform float uTime;
        uniform sampler2D uTxue;
        uniform sampler2D uBgTxue;
        uniform float uOpacity;
        uniform float uSpeed;
        uniform vec4 uColor;
        uniform bool uIsTxue;
        uniform vec2 uRepeat;
        uniform vec4 uBgColor;
        uniform vec2 uBgRepeat;
        uniform bool uIsBgTxue;
        uniform bool uLoop;
        uniform float uRadio;
        uniform bool uIsSyn;
        uniform bool uIsFade;
        varying vec2 vUv;

        void main() {
            float num;
            float p = 1.;
            vec4 lColor = uColor;
            vec4 bgColor = uBgColor;

            // 是否循环
            if(uLoop){
                if (uTime > 1.){
                    lColor.w *= (1. + uRadio - uTime) / uRadio;
                }
            }else {
                if(uTime >= 1.){
                    num = 1.;
                }
            }

            if(vUv.x > uTime && uTime <= 1.){
                lColor.w = .0;
                if(uIsSyn){
                    bgColor.w = .0;
                }
            }

            if(uIsTxue && !uLoop && uTime == 1.){
                // 外部不循环就做内部循环
                lColor *= texture2D(uTxue, vec2(( vUv.x - num - uTime) * uRepeat.x, vUv.y * uRepeat.y));
            }else if(uIsTxue){
                lColor *= texture2D(uTxue, vec2((vUv.x - uTime) * uRepeat.x, vUv.y * uRepeat.y));
            }

            // 背景
            if(uIsBgTxue){
                // bgColor *= texture2D(uBgTxue , vUv * uBgRepeat);
                bgColor *= texture2D(uBgTxue , vec2((1. - uTime + vUv.x) * uBgRepeat.x, vUv.y * uBgRepeat.y));
            }

            // 首尾透明
            if(uIsFade && vUv.x <=0.1){
                lColor.w *= vUv.x * 10.;
            }else if(uIsFade && vUv.x >=0.9){
                lColor.w *= (1. - vUv.x) * 10.;
            }

            float F = lColor.w + bgColor.w * (1. - lColor.w);
            gl_FragColor = (lColor * lColor.w + bgColor * bgColor.w * (1. - lColor.w)) / F;
            gl_FragColor.w *= uOpacity;
        }
    `
};

export default PATH_SHADER;
