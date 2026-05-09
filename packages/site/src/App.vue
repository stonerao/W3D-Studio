<template>
  <header class="site-header">
    <div class="header-inner">
      <RouterLink to="/" class="site-logo">
        <span class="site-logo-mark"></span>
        <span class="site-logo-text">
          <strong>Visualization</strong>
          <span>Platform</span>
        </span>
      </RouterLink>

      <nav class="site-nav">
        <RouterLink to="/">首页</RouterLink>
        <RouterLink to="/product">产品能力</RouterLink>
        <RouterLink to="/scenarios">行业场景</RouterLink>
        <RouterLink to="/ecosystem">生态扩展</RouterLink>
        <RouterLink to="/experience" class="nav-cta">立即体验</RouterLink>
      </nav>
    </div>
  </header>

  <main class="site-main">
    <RouterView />
  </main>

  <footer class="site-footer">
    <p class="site-footer-records">
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
        蜀ICP备2025167677号-1
      </a>
      <span>|</span>
      <a href="http://www.beian.gov.cn/" target="_blank" rel="noopener noreferrer">
        川公网安备51011202001161号
      </a>
    </p>
    <p class="site-footer-copy">© 2025 个人作品展示 版权所有</p>
  </footer>
</template>
