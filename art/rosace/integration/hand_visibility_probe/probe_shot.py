"""Own temporary camera/pass setup values; restore exact prior private state."""
class ShotSnapshot:
    def __init__(self, scene, driver, bpy):
        self.scene,self.bpy = scene,bpy
        self.rows=[]
        self.camera=scene.camera
        self.before_objects={obj.as_pointer() for obj in scene.objects}
        for key in ("resolution_x","resolution_y","resolution_percentage","filepath"):
            self.keep(scene.render,key)
        for name in ("render_cam","key_light"):
            obj=scene.objects.get(name)
            if obj is None:
                continue
            for key in ("location","rotation_mode","rotation_quaternion","rotation_euler","rotation_axis_angle"):
                self.keep(obj,key)
            if name=="render_cam":
                for key in ("ortho_scale","clip_start","clip_end"):
                    self.keep(obj.data,key)
        for name in driver.materials.PASS_NODES:
            nodes=bpy.data.materials[name].node_tree.nodes
            spec=nodes.get("spec_h")
            depth=nodes.get("depth_map")
            for socket in [spec.inputs[i] for i in range(3)] if spec else []:
                self.keep(socket,"default_value")
            if depth:
                for key in ("From Min","From Max"):
                    self.keep(depth.inputs[key],"default_value")

    def keep(self,obj,key):
        value=getattr(obj,key)
        self.rows.append((obj,key,value.copy() if hasattr(value,"copy") else value))

    def restore(self):
        errors=[]
        for obj,key,value in reversed(self.rows):
            try:
                setattr(obj,key,value)
            except BaseException as error:
                errors.append(str(error))
        self.scene.camera=self.camera
        for obj in list(self.scene.objects):
            if obj.as_pointer() not in self.before_objects and obj.type in ("CAMERA","LIGHT"):
                try:
                    kind=obj.type
                    data=obj.data
                    self.bpy.data.objects.remove(obj,do_unlink=True)
                    collection=self.bpy.data.cameras if kind=="CAMERA" else self.bpy.data.lights
                    if data.users==0:
                        collection.remove(data)
                except BaseException as error:
                    errors.append(str(error))
        if errors:
            raise RuntimeError("camera/pass snapshot restoration failed: "+"; ".join(errors))
