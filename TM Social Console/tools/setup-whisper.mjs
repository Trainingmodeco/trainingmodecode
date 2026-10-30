// One-time: install whisper.cpp and the speech model into ./whisper.cpp.
// Windows downloads a prebuilt binary; Mac/Linux compile it (needs git + make).
import { installWhisperCpp, downloadWhisperModel } from '@remotion/install-whisper-cpp';
import { WHISPER } from './lib.mjs';

await installWhisperCpp({ to: WHISPER.path, version: WHISPER.version });
await downloadWhisperModel({ model: WHISPER.model, folder: WHISPER.path });
console.log(`whisper.cpp ${WHISPER.version} + model ${WHISPER.model} ready in ${WHISPER.path}`);
