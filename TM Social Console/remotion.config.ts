// Remotion CLI settings (studio + `npx remotion render`). tools/render.mjs
// passes the same options to the Node renderer.
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setCodec('h264');
Config.setCrf(18);
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
// Only for machines that can't download Remotion's browser (some cloud
// sandboxes): point at an installed Chrome Headless Shell instead.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
