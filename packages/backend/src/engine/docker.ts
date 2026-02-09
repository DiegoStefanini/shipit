import Dockerode from 'dockerode';

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

export async function buildImage(
  contextPath: string,
  tag: string,
  onLog: (line: string) => void,
): Promise<string> {
  const stream = await docker.buildImage(
    { context: contextPath, src: ['.'] },
    { t: tag },
  );

  const buildPromise = new Promise<string>((resolve, reject) => {
    docker.modem.followProgress(
      stream,
      (err: Error | null, output: Array<{ aux?: { ID?: string } }>) => {
        if (err) return reject(err);
        const imageId = output
          .filter((o) => o.aux?.ID)
          .map((o) => o.aux!.ID!)
          .pop();
        resolve(imageId ?? tag);
      },
      (event: { stream?: string; error?: string }) => {
        if (event.stream) onLog(event.stream.trimEnd());
        if (event.error) onLog(`ERROR: ${event.error}`);
      },
    );
  });

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Build timed out after 10 minutes')), 10 * 60 * 1000),
  );

  return Promise.race([buildPromise, timeout]);
}

export async function runContainer(
  name: string,
  imageTag: string,
  network: string,
  labels: Record<string, string>,
): Promise<string> {
  const container = await docker.createContainer({
    Image: imageTag,
    name,
    Labels: labels,
    HostConfig: {
      Memory: 256 * 1024 * 1024,
      NetworkMode: network,
      RestartPolicy: { Name: 'unless-stopped' },
    },
  });
  await container.start();
  return container.id;
}

export async function stopAndRemove(containerId: string): Promise<void> {
  try {
    const container = docker.getContainer(containerId);
    await container.stop().catch(() => {});
    await container.remove({ force: true });
  } catch {
    // Container may already be removed
  }
}

export async function pruneOldImages(projectName: string): Promise<void> {
  const images = await docker.listImages();
  const projectImages = images.filter((img: Dockerode.ImageInfo) =>
    img.RepoTags?.some((t: string) => t.startsWith(`shipit-${projectName}:`)),
  );

  // Keep only the latest image, remove the rest
  if (projectImages.length <= 1) return;

  const sorted = projectImages.sort((a: Dockerode.ImageInfo, b: Dockerode.ImageInfo) => b.Created - a.Created);
  for (const img of sorted.slice(1)) {
    try {
      await docker.getImage(img.Id).remove({ force: true });
    } catch {
      // Ignore removal errors
    }
  }
}
