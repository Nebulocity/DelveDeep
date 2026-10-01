"""One frame per static layer; never saves or animates the Blender source file."""
import bpy, pathlib
out=pathlib.Path(__file__).resolve().parents[2]/'environments'/'slime-cave'
out.mkdir(parents=True,exist_ok=True)
s=bpy.data.scenes['DD_Export'];s.frame_set(1)
bpy.context.window.scene=s
for layer,filename in [('DD_Background','background.png'),('DD_Battlefield','battlefield.png'),('DD_Foreground','foreground.png')]:
    for v in s.view_layers:v.use=v.name==layer
    s.render.filepath=str(out/filename)
    bpy.ops.render.render(write_still=True,scene=s.name,layer=layer)
    print('EXPORTED',filename,flush=True)
