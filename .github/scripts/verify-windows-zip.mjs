import { exactArchive } from '../../tools/agent-workflow/src/portable-zip.mjs';

const [path, exeName, exeHash, readmeHash] = process.argv.slice(2);
try {
  if (!path || !exeName || !exeHash || !readmeHash) throw new Error('Expected ZIP path, EXE name and two SHA-256 digests.');
  await exactArchive(path, { [exeName]: exeHash, 'README.txt': readmeHash }, { allowFileAttributes: true });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
