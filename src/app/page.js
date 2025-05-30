'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Calendar, Cpu, Droplet, Flame, Gauge, Thermometer, 
  ToggleLeft, Activity, Clock, Filter, AlertTriangle, RefreshCw
} from 'lucide-react';
import { supabase } from "./utils/supabaseClient";

// Main component
export default function Dashboard() {
  // Sensor data state
  const [sensorData, setSensorData] = useState({
    ph: 0,
    temp: 0,
    ch4: 0,
    pressure: 0
  });
  
  // Historical sensor data for charts
  const [historicalData, setHistoricalData] = useState([]);
  
  // Sensor error data
  const [sensorErrors, setSensorErrors] = useState([]);
  
  // Date range for filtering chart data
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0], // Last 24 hours
    end: new Date().toISOString().split('T')[0]
  });
  
  // Loading state for charts
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);
  
  // Auto-refresh toggle
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // pH Calibration state
  const [phCalibration, setPhCalibration] = useState({
    referencePh: '',
    currentPh: '',
    isCalibrating: false
  });
  
  // Actuator states
  const [actuators, setActuators] = useState({
    pump_acid: 0,
    pump_base: 0,
    heater: 0,
    solenoid: 0,
    stirrer: 0
  });
  
  // Function to fetch historical data and sensor errors
  const fetchChartData = useCallback(async () => {
    setIsLoadingCharts(true);
    
    try {
      // Fetch historical sensor data
      const { data: historicalData, error: historicalError } = await supabase
        .from('sensors')
        .select('*')
        .gte('created_at', `${dateRange.start}T00:00:00Z`)
        .lte('created_at', `${dateRange.end}T23:59:59Z`)
        .order('created_at', { ascending: true });
        
      if (historicalError) {
        console.error('Error fetching historical data:', historicalError);
      } else {
        // Format data for charts
        const formattedData = historicalData.map(item => ({
          timestamp: new Date(item.created_at).toLocaleTimeString(),
          ph: item.ph,
          temp: item.temp,
          ch4: item.ch4,
          pressure: item.pressure
        }));
        
        setHistoricalData(formattedData);
      }
      
      // Fetch sensor errors
      const { data: errorData, error: errorError } = await supabase
        .from('sensor_errors')
        .select('*')
        .gte('created_at', `${dateRange.start}T00:00:00Z`)
        .lte('created_at', `${dateRange.end}T23:59:59Z`)
        .order('created_at', { ascending: true });
        
      if (errorError) {
        console.error('Error fetching sensor errors:', errorError);
      } else {
        console.log("sensor error: ", errorData);
        
        // Format error data for charts
        const formattedErrorData = errorData.map(item => ({
          timestamp: new Date(item.created_at).toLocaleTimeString(),
          ph_error: item.ph_error,
          ph_delta_error: item.ph_delta_error,
          temp_error: item.temp_error,
          temp_delta_error: item.temp_delta_error
        }));
        
        setSensorErrors(formattedErrorData);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setIsLoadingCharts(false);
    }
  }, [dateRange]);
  
  // Fetch the latest sensor data
  useEffect(() => {
    const fetchSensorData = async () => {
      const { data, error } = await supabase
        .from('sensors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (error) {
        console.error('Error fetching sensor data:', error);
        return;
      }
      
      if (data && data.length > 0) {
        setSensorData({
          ph: data[0].ph,
          temp: data[0].temp,
          ch4: data[0].ch4,
          pressure: data[0].pressure
        });
      }
    };
    
    // Fetch latest sensor data
    fetchSensorData();
    
    // Set up real-time subscription to sensor data
    const subscription = supabase
      .channel('sensor-changes')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'sensors' }, 
        payload => {
          setSensorData({
            ph: payload.new.ph,
            temp: payload.new.temp,
            ch4: payload.new.ch4,
            pressure: payload.new.pressure
          });
          
          // Auto-refresh chart data when new sensor data arrives
          if (autoRefresh) {
            fetchChartData();
          }
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchChartData, autoRefresh]);
  
  // Fetch chart data when date range changes or component mounts
  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);
  
  // Auto-refresh chart data every 10 seconds if auto-refresh is enabled
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchChartData();
    }, 10000); // 10 seconds
    
    return () => clearInterval(interval);
  }, [fetchChartData, autoRefresh]);
  
  // Function to fetch actuator states
  const fetchActuators = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('actuators')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);
        
      if (error) {
        console.error('Error fetching actuators:', error);
        return;
      }
      
      if (data && data.length > 0) {
        setActuators({
          pump_acid: data[0].pump_acid,
          pump_base: data[0].pump_base,
          heater: data[0].heater,
          solenoid: data[0].solenoid,
          stirrer: data[0].stirrer
        });
      }
    } catch (error) {
      console.error('Error fetching actuators:', error);
    }
  }, []);
  
  // Fetch actuator states
  useEffect(() => {
    fetchActuators();
    
    // Set up real-time subscription for actuators
    const actuatorsSubscription = supabase
      .channel('actuator-changes')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'actuators' }, 
        payload => {
          setActuators({
            pump_acid: payload.new.pump_acid,
            pump_base: payload.new.pump_base,
            heater: payload.new.heater,
            solenoid: payload.new.solenoid,
            stirrer: payload.new.stirrer
          });
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(actuatorsSubscription);
    };
  }, [fetchActuators]);
  
  // Auto-refresh actuator data every 10 seconds if auto-refresh is enabled
  useEffect(() => {
    if (!autoRefresh) return;
    
    const actuatorInterval = setInterval(() => {
      fetchActuators();
    }, 10000); // 10 seconds - more frequent for actuator status
    
    return () => clearInterval(actuatorInterval);
  }, [fetchActuators, autoRefresh]);
  
  // Function to handle pH calibration
  const handlePhCalibration = async () => {
    if (!phCalibration.referencePh || !phCalibration.currentPh) {
      alert('Mohon isi kedua nilai pH');
      return;
    }
    
    const refPh = parseFloat(phCalibration.referencePh);
    const curPh = parseFloat(phCalibration.currentPh);
    
    if (isNaN(refPh) || isNaN(curPh)) {
      alert('Nilai pH harus berupa angka yang valid');
      return;
    }
    
    if (refPh < 0 || refPh > 14 || curPh < 0 || curPh > 14) {
      alert('Nilai pH harus berada dalam rentang 0-14');
      return;
    }
    
    setPhCalibration(prev => ({ ...prev, isCalibrating: true }));
    
    try {
      const response = await fetch('/api/calibrate-ph', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          referencePh: refPh,
          currentPh: curPh
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`Kalibrasi pH berhasil!\nOffset: ${result.data.offset.toFixed(3)}`);
        setPhCalibration({
          referencePh: '',
          currentPh: '',
          isCalibrating: false
        });
      } else {
        alert(`Kalibrasi pH gagal: ${result.message}`);
      }
    } catch (error) {
      console.error('Error during pH calibration:', error);
      alert('Terjadi kesalahan saat kalibrasi pH');
    } finally {
      setPhCalibration(prev => ({ ...prev, isCalibrating: false }));
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Cpu className="h-8 w-8" />
              <h1 className="text-2xl font-bold">BioKontrol Dashboard</h1>
            </div>
            {/* Auto-refresh toggle */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm">Auto-refresh:</span>
                <button 
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`px-3 py-1 rounded-full flex items-center ${
                    autoRefresh ? 'bg-green-500' : 'bg-gray-500'
                  }`}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
                  <span className="text-sm">{autoRefresh ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Sensor Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* pH Card */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-700">pH Level</h2>
              <Droplet className="h-6 w-6 text-blue-500" />
            </div>
            <div className="flex flex-col items-center">
              <div className="text-4xl font-bold text-blue-600">{sensorData.ph.toFixed(2)}</div>
              <div className="text-sm text-gray-500 mt-2">
                Optimal: 6.5 - 7.5
              </div>
            </div>
          </div>
          
          {/* Temperature Card */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-700">Temperature</h2>
              <Thermometer className="h-6 w-6 text-red-500" />
            </div>
            <div className="flex flex-col items-center">
              <div className="text-4xl font-bold text-red-600">{sensorData.temp.toFixed(1)}°C</div>
              <div className="text-sm text-gray-500 mt-2">
                Optimal: 25°C - 30°C
              </div>
            </div>
          </div>
          
          {/* CH4 Card */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-700">CH4 Level</h2>
              <Flame className="h-6 w-6 text-yellow-500" />
            </div>
            <div className="flex flex-col items-center">
              <div className="text-4xl font-bold text-yellow-600">{sensorData.ch4.toFixed(2)} ppm</div>
              <div className="text-sm text-gray-500 mt-2">
                Warning: Above 1000 ppm
              </div>
            </div>
          </div>
          
          {/* Pressure Card */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-700">Pressure</h2>
              <Gauge className="h-6 w-6 text-indigo-500" />
            </div>
            <div className="flex flex-col items-center">
              <div className="text-4xl font-bold text-indigo-600">{sensorData.pressure.toFixed(2)} kPa</div>
              <div className="text-sm text-gray-500 mt-2">
                Normal: 100 - 110 kPa
              </div>
            </div>
          </div>
        </div>
        
        {/* Charts Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-700 flex items-center">
              <Activity className="h-6 w-6 mr-2 text-blue-500" />
              Sensor Data History & Error Analysis
              {isLoadingCharts && (
                <RefreshCw className="h-5 w-5 ml-2 text-blue-500 animate-spin" />
              )}
            </h2>
            
            {/* Date Range Filter - Auto applies on change */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-gray-500" />
                <input 
                  type="date" 
                  value={dateRange.start}
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  className="border rounded px-2 py-1 text-sm text-gray-700"
                />
              </div>
              <div className="text-gray-500">to</div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-gray-500" />
                <input 
                  type="date" 
                  value={dateRange.end}
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  className="border rounded px-2 py-1 text-sm text-gray-700"
                />
              </div>
              <button 
                onClick={fetchChartData}
                disabled={isLoadingCharts}
                className="bg-blue-500 text-white px-3 py-1 rounded flex items-center text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoadingCharts ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
          
          {/* Chart Container */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* pH Data and Error Chart */}
            <div className="h-80">
              <h3 className="text-lg font-medium text-gray-700 mb-2 flex items-center">
                <Droplet className="h-5 w-5 mr-1 text-blue-500" />
                pH Level & Error Analysis
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="ph" stroke="#3B82F6" name="pH Value" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* pH Error Chart */}
            <div className="h-80">
              <h3 className="text-lg font-medium text-gray-700 mb-2 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-1 text-orange-500" />
                pH Error Values
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sensorErrors}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="ph_error" stroke="#F59E0B" name="pH Error" strokeWidth={2} />
                  <Line type="monotone" dataKey="ph_delta_error" stroke="#EF4444" name="pH Delta Error" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Temperature Data Chart */}
            <div className="h-80">
              <h3 className="text-lg font-medium text-gray-700 mb-2 flex items-center">
                <Thermometer className="h-5 w-5 mr-1 text-red-500" />
                Temperature Level & Error Analysis
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="temp" stroke="#EF4444" name="Temperature (°C)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Temperature Error Chart */}
            <div className="h-80">
              <h3 className="text-lg font-medium text-gray-700 mb-2 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-1 text-orange-500" />
                Temperature Error Values
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sensorErrors}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="temp_error" stroke="#F59E0B" name="Temp Error" strokeWidth={2} />
                  <Line type="monotone" dataKey="temp_delta_error" stroke="#EF4444" name="Temp Delta Error" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* CH4 Chart */}
            <div className="h-80">
              <h3 className="text-lg font-medium text-gray-700 mb-2 flex items-center">
                <Flame className="h-5 w-5 mr-1 text-yellow-500" />
                CH4 Level
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="ch4" stroke="#F59E0B" name="CH4 (ppm)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Pressure Chart */}
            <div className="h-80">
              <h3 className="text-lg font-medium text-gray-700 mb-2 flex items-center">
                <Gauge className="h-5 w-5 mr-1 text-indigo-500" />
                Pressure Level
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="pressure" stroke="#6366F1" name="Pressure (kPa)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        
        {/* Actuator Controls */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Cpu className="h-6 w-6 mr-2 text-gray-700" />
              <h2 className="text-xl font-semibold text-gray-700">Actuator Status Monitor</h2>
            </div>
            <button 
              onClick={fetchActuators}
              className="bg-blue-500 text-white px-3 py-1 rounded flex items-center text-sm hover:bg-blue-600"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh Status
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Acid Pump Control */}
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-gray-700">Acid Pump</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  actuators.pump_acid > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {actuators.pump_acid > 0 ? 'Active' : 'Inactive'}
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm text-gray-600 mb-1">
                  PWM Value: {actuators.pump_acid}
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="255" 
                  value={actuators.pump_acid}
                  disabled={true}
                  className="w-full opacity-50 cursor-not-allowed"
                />
              </div>
              
              <div className="mt-2 text-sm text-gray-500 flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                System Controlled
              </div>
            </div>
            
            {/* Base Pump Control */}
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-gray-700">Base Pump</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  actuators.pump_base > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {actuators.pump_base > 0 ? 'Active' : 'Inactive'}
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm text-gray-600 mb-1">
                  PWM Value: {actuators.pump_base}
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="255" 
                  value={actuators.pump_base}
                  disabled={true}
                  className="w-full opacity-50 cursor-not-allowed"
                />
              </div>
              
              <div className="mt-2 text-sm text-gray-500 flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                System Controlled
              </div>
            </div>
            
            {/* Heater Control */}
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-gray-700">Heater</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  actuators.heater > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {actuators.heater > 0 ? 'Active' : 'Inactive'}
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm text-gray-600 mb-1">
                  PWM Value: {actuators.heater}
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="255" 
                  value={actuators.heater}
                  disabled={true}
                  className="w-full opacity-50 cursor-not-allowed"
                />
              </div>
              
              <div className="mt-2 text-sm text-gray-500 flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                System Controlled
              </div>
            </div>
            
            {/* Solenoid Control */}
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-gray-700">Solenoid Valve</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  actuators.solenoid > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {actuators.solenoid > 0 ? 'Open' : 'Closed'}
                </div>
              </div>
              
              <div className="mt-2 text-sm text-gray-500 flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                System Controlled
              </div>
            </div>
            
            {/* Stirrer/Motor Control */}
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-gray-700">Stirrer Motor</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  actuators.stirrer > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {actuators.stirrer > 0 ? 'Running' : 'Stopped'}
                </div>
              </div>
              
              <div className="mt-2 text-sm text-gray-500 flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                System Controlled
              </div>
            </div>
          </div>
        </div>

        {/* pH Calibration Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-8">
          <div className="flex items-center mb-6">
            <Droplet className="h-6 w-6 mr-2 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-700">Kalibrasi pH Sensor</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Reference pH Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nilai pH Meter (Referensi)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="14"
                value={phCalibration.referencePh}
                onChange={(e) => setPhCalibration(prev => ({ ...prev, referencePh: e.target.value }))}
                placeholder="Contoh: 7.00"
                disabled={phCalibration.isCalibrating}
                className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Nilai pH dari alat ukur standar</p>
            </div>
            
            {/* Current pH Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nilai pH Sensor Saat Ini
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="14"
                value={phCalibration.currentPh}
                onChange={(e) => setPhCalibration(prev => ({ ...prev, currentPh: e.target.value }))}
                placeholder="Contoh: 6.85"
                disabled={phCalibration.isCalibrating}
                className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Nilai pH yang terbaca sensor</p>
            </div>
            
            {/* Calibration Button and Info */}
            <div>
              <button
                onClick={handlePhCalibration}
                disabled={phCalibration.isCalibrating || !phCalibration.referencePh || !phCalibration.currentPh}
                className="w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {phCalibration.isCalibrating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Mengkalibrasi...
                  </>
                ) : (
                  <>
                    <Droplet className="h-4 w-4 mr-2" />
                    Kalibrasi pH
                  </>
                )}
              </button>
              
              {/* Calculate and show offset preview */}
              {phCalibration.referencePh && phCalibration.currentPh && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                  <div className="text-gray-600">Offset yang akan dikirim:</div>
                  <div className="font-mono text-blue-600">
                    {(parseFloat(phCalibration.referencePh) - parseFloat(phCalibration.currentPh)).toFixed(3)}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Cara Kalibrasi:</h3>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. Ukur pH larutan dengan pH meter standar</li>
              <li>2. Masukkan nilai pH meter ke kolom "Nilai pH Meter"</li>
              <li>3. Masukkan nilai pH yang terbaca sensor ke kolom "Nilai pH Sensor"</li>
              <li>4. Klik tombol "Kalibrasi pH" untuk mengirim offset ke ESP32</li>
            </ol>
          </div>
        </div>
      </main>
      
      <footer className="bg-gray-800 text-white py-4 mt-8">
        <div className="container mx-auto px-4 text-center">
          <p>BioKontrol &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}