# Roda job_anim5.py num Blender separado, em segundo plano (sem travar a janela)
import subprocess, bpy, os
B = r"C:\Users\Administrador\Documents\Claude_Blender\parecis"
lf = open(os.path.join(B, "saida_anim5.txt"), "w")
subprocess.Popen([bpy.app.binary_path, "-b", "--factory-startup", "--python", os.path.join(B, "job_anim5.py")], stdout=lf, stderr=subprocess.STDOUT)
print("job_anim iniciado em segundo plano")
