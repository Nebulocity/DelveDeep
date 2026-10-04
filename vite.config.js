import { randomUUID } from 'node:crypto';
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    __DELVE_DEEP_BUILD_ID__: JSON.stringify(randomUUID())
  }
});
