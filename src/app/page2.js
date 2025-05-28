'use client';

import { useEffect, useState } from "react";
import { supabase } from "./utils/supabaseClient";
import SensorCard from "./components/SensorCard";
import ActuatorControl from "./components/ActuatorControl";
import ModeToggle from "./components/ModeTogle";
import ControlModeToggle from "./components/ControlModeToggle";

export default function Home() {
  const [sensorData, setSensorData] = useState({});
  const [actuator, setActuator] = useState({});
  const [isAuto, setIsAuto] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: sensors, error: sensorError } = await supabase
        .from("sensors")
        .select("*")
        .order("created_at", { ascending: false });
    
      const { data: actuators, error: actuatorError } = await supabase
        .from("actuators")
        .select("*")
        .order("updated_at", { ascending: false });
    
      const { data: control, error: controlError } = await supabase
        .from("control_mode")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1);
    
      if (sensorError || actuatorError || controlError) {
        console.error("Fetch error:", sensorError || actuatorError || controlError);
        return;
      }
    
      if (sensors && sensors.length > 0) {
        const formattedSensors = {};
        sensors.forEach((s) => {
          formattedSensors[s.type] = s.value;
        });
        setSensorData(formattedSensors);
      }
    
      if (actuators && actuators.length > 0) {
        const formattedActuators = {};
        actuators.forEach((a) => {
          formattedActuators[a.type] = a.value;
        });
        setActuator(formattedActuators);
      }
    
      if (control && control.length > 0) {
        setIsAuto(control[0].is_auto);
      }
    };    
  
    fetchInitialData();
  }, []);  

  return (
    <div className="min-h-screen bg-gray-800 p-6">
      <h1 className="text-2xl font-bold mb-4">Biogas Reaktor Dashboard</h1>
      <ControlModeToggle isAuto={isAuto} setIsAuto={setIsAuto} />

      <ModeToggle isAuto={isAuto} setIsAuto={setIsAuto} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SensorCard
          title="Suhu Reaktor"
          value={sensorData.temp}
          unit="°C"
        />
        <SensorCard title="pH" value={sensorData.ph} unit="" />
        <SensorCard title="CH₄" value={sensorData.ch4} unit="ppm" />
        <SensorCard title="Tekanan" value={sensorData.pressure} unit="hPa" />
      </div>

      <div className="bg-gray-500 p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Kontrol Aktuator</h2>
        <ActuatorControl
          label="Pompa Asam"
          actuatorKey="pump_acid"
          value={actuator.pump_acid || 0}
          disabled={isAuto}
          onChange={(v) => setActuator({ ...actuator, pump_acid: v })}
        />
        <ActuatorControl
          label="Pompa Basa"
          actuatorKey="pump_base"
          value={actuator.pump_base || 0}
          disabled={isAuto}
          onChange={(v) => setActuator({ ...actuator, pump_base: v })}
        />
        <ActuatorControl
          label="Heater"
          actuatorKey="heater"
          value={actuator.heater || 0}
          disabled={isAuto}
          onChange={(v) => setActuator({ ...actuator, heater: v })}
        />
        <ActuatorControl
          label="Solenoid"
          actuatorKey="solenoid"
          value={actuator.solenoid ? 255 : 0}
          disabled={isAuto}
          onChange={(v) => setActuator({ ...actuator, solenoid: v > 0 })}
        />
        <ActuatorControl
          label="Motor"
          actuatorKey="stirrer"
          value={actuator.stirrer ? 255 : 0}
          disabled={isAuto}
          onChange={(v) => setActuator({ ...actuator, stirrer: v > 0 })}
        />
      </div>
    </div>
  );
}
