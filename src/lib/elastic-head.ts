export type HeadExpression = "smile" | "surprised" | "ouch";

type Point = { x: number; y: number };

export async function createElasticHead(
  canvas: HTMLCanvasElement,
  art: SVGGElement,
  outline: SVGClipPathElement,
) {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    depth: false,
  });
  if (!gl) {
    return null;
  }
  const context = gl;
  const shaders: WebGLShader[] = [];
  const textures = new Map<HeadExpression, WebGLTexture>();
  const program = gl.createProgram();
  const positions = gl.createBuffer();
  const coordinates = gl.createBuffer();
  const indices = gl.createBuffer();
  const { x: sourceX, y: sourceY, width, height } = art.querySelector("svg")!.viewBox.baseVal;
  const padding = 140;

  function dispose() {
    textures.forEach((texture) => context.deleteTexture(texture));
    shaders.forEach((shader) => context.deleteShader(shader));
    context.deleteProgram(program);
    context.deleteBuffer(positions);
    context.deleteBuffer(coordinates);
    context.deleteBuffer(indices);
    context.getExtension("WEBGL_lose_context")?.loseContext();
  }

  try {
    if (!program || !positions || !coordinates || !indices) {
      throw new Error("Head renderer allocation failed");
    }
    function shader(type: number, source: string) {
      const result = context.createShader(type);
      if (!result) {
        throw new Error("Head shader allocation failed");
      }
      shaders.push(result);
      context.shaderSource(result, source);
      context.compileShader(result);
      return result;
    }
    gl.attachShader(
      program,
      shader(
        gl.VERTEX_SHADER,
        `
      attribute vec2 position;
      attribute vec2 uv;
      varying vec2 texCoord;
      uniform vec2 size;
      void main() {
        texCoord = uv;
        vec2 p = (position + ${padding}.0) / size;
        gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
      }
    `,
      ),
    );
    gl.attachShader(
      program,
      shader(
        gl.FRAGMENT_SHADER,
        `
      precision mediump float;
      varying vec2 texCoord;
      uniform sampler2D face;
      void main() {
        gl_FragColor = texture2D(face, texCoord);
      }
    `,
      ),
    );
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("Head shader linking failed");
    }
    gl.useProgram(program);
    gl.uniform2f(gl.getUniformLocation(program, "size"), width + padding * 2, height + padding * 2);
    gl.uniform1i(gl.getUniformLocation(program, "face"), 0);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const columns = 28;
    const rows = 32;
    const uv: number[] = [];
    const triangles: number[] = [];
    for (let row = 0; row <= rows; row++) {
      for (let column = 0; column <= columns; column++) {
        uv.push(column / columns, row / rows);
        if (column < columns && row < rows) {
          const start = row * (columns + 1) + column;
          triangles.push(
            start,
            start + 1,
            start + columns + 1,
            start + 1,
            start + columns + 2,
            start + columns + 1,
          );
        }
      }
    }
    const vertices = new Float32Array(uv.length);
    const weights = new Float32Array(uv.length / 2);
    gl.bindBuffer(gl.ARRAY_BUFFER, coordinates);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);
    const uvLocation = gl.getAttribLocation(program, "uv");
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, positions);
    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(triangles), gl.STATIC_DRAW);

    const sheet = new Image();
    sheet.src = art.querySelector("image")!.href.baseVal;
    await sheet.decode();
    const source = document.createElement("canvas");
    source.width = width;
    source.height = height;
    const paint = source.getContext("2d")!;
    paint.translate(-sourceX, -sourceY);
    for (let i = 0; i < outline.transform.baseVal.numberOfItems; i++) {
      const m = outline.transform.baseVal.getItem(i).matrix;
      paint.transform(m.a, m.b, m.c, m.d, m.e, m.f);
    }
    paint.clip(new Path2D(outline.querySelector("path")!.getAttribute("d")!));
    paint.setTransform(1, 0, 0, 1, -sourceX, -sourceY);
    paint.drawImage(sheet, 0, 0);
    const face = art.querySelector<SVGGElement>("[data-face]")!.cloneNode(true) as SVGGElement;
    face.removeAttribute("style");
    face.querySelector("[data-pupils]")!.removeAttribute("style");
    for (const expression of ["smile", "surprised", "ouch"] as const) {
      face.querySelectorAll<SVGGElement>("[data-face-expression]").forEach((part) => {
        part.style.display = part.dataset.faceExpression === expression ? "inline" : "none";
      });
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${new XMLSerializer().serializeToString(face)}</svg>`)}`;
      await image.decode();
      const composite = document.createElement("canvas");
      composite.width = width;
      composite.height = height;
      const drawing = composite.getContext("2d")!;
      drawing.drawImage(source, 0, 0);
      drawing.drawImage(image, 0, 0);
      const texture = gl.createTexture();
      if (!texture) {
        throw new Error("Head texture allocation failed");
      }
      textures.set(expression, texture);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, composite);
    }

    let grip: Point = { x: 0, y: 0 };
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;

    return {
      dispose,
      resize(scale: number) {
        canvas.width = Math.max(1, Math.round((width + padding * 2) * scale));
        canvas.height = Math.max(1, Math.round((height + padding * 2) * scale));
        context.viewport(0, 0, canvas.width, canvas.height);
      },
      grab(point: Point) {
        grip = point;
        for (let i = 0; i < weights.length; i++) {
          const px = uv[i * 2] * width;
          const py = uv[i * 2 + 1] * height;
          // The chin tapers to a fixed neck; the grip must not detach the head from the body.
          const anchor = Math.min(1, Math.max(0, (475 - py) / 160));
          weights[i] =
            Math.exp(-((px - point.x) ** 2 + (py - point.y) ** 2) / (2 * 150 ** 2)) * anchor;
        }
      },
      pull(point: Point) {
        const dx = point.x - grip.x;
        const dy = point.y - grip.y;
        const distance = Math.hypot(dx, dy);
        const resistance = distance ? (140 * Math.tanh(distance / 140)) / distance : 1;
        targetX = dx * resistance;
        targetY = dy * resistance;
        return distance;
      },
      release() {
        targetX = targetY = 0;
      },
      reset() {
        x = y = vx = vy = targetX = targetY = 0;
      },
      draw(elapsed: number, expression: HeadExpression) {
        const steps = Math.max(1, Math.ceil(elapsed / 0.008));
        const dt = elapsed / steps;
        for (let i = 0; i < steps; i++) {
          vx += ((targetX - x) * 240 - vx * 18) * dt;
          vy += ((targetY - y) * 240 - vy * 18) * dt;
          x += vx * dt;
          y += vy * dt;
        }
        const moving =
          Math.abs(targetX - x) + Math.abs(targetY - y) + Math.abs(vx) + Math.abs(vy) > 0.1;
        if (!moving) {
          x = targetX;
          y = targetY;
          vx = vy = 0;
        }
        for (let i = 0; i < weights.length; i++) {
          vertices[i * 2] = uv[i * 2] * width + x * weights[i];
          vertices[i * 2 + 1] = uv[i * 2 + 1] * height + y * weights[i];
        }
        context.clear(context.COLOR_BUFFER_BIT);
        context.bindTexture(context.TEXTURE_2D, textures.get(expression)!);
        context.bindBuffer(context.ARRAY_BUFFER, positions);
        context.bufferData(context.ARRAY_BUFFER, vertices, context.DYNAMIC_DRAW);
        context.drawElements(context.TRIANGLES, triangles.length, context.UNSIGNED_SHORT, 0);
        return moving;
      },
    };
  } catch {
    dispose();
    return null;
  }
}

export type ElasticHead = NonNullable<Awaited<ReturnType<typeof createElasticHead>>>;
