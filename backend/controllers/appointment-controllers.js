const HttpError = require('../models/http-error');
const Appointment = require('../models/appointment');
const Doctor = require('../models/doctor');
const Patient = require('../models/patient');
const mongoose = require('mongoose');

exports.getAllAppointments = async (req, res, next) => {
    let appointments;
    try {
        appointments = await Appointment.find();
    } catch (error) {
        return next(new HttpError('Something went wrong, could not get appointments', 500));
    }

    res.status(200).json({ appointments: appointments.map(appointment => appointment.toObject({ getters: true })) });
}

exports.createAppointment = async (req, res, next) => {
    const {
        doctorId,
        patientId,
        doctorName,
        patientName,
        phoneNo,
        email,
        date,
        time,
        diagnosis
    } = req.body;
    const createdAppointment = new Appointment({
        doctorId,
        patientId,
        doctorName,
        patientName,
        phoneNo,
        email,
        date,
        time,
        diagnosis
    });
    try {
        const doctor = await Doctor.findById(doctorId);
        let patient;
        patient = await Patient.findById(patientId);
        if (!doctor || !patient) {
            throw new HttpError('Could not find doctor or patient for this appointment', 404);
        }
        let session;
        session = await mongoose.startSession();
        session.startTransaction();
        await createdAppointment.save({ session: session });
        doctor.appointments.push(createdAppointment);
        await doctor.save({ session: session });
        patient.appointments.push(createdAppointment);
        await patient.save({ session: session });
        await session.commitTransaction();
    } catch (error) {
        console.log(error.message);
        return next(new HttpError('Something went wrong, could not create appointment', 500));
    }
    res.status(201).json({
        appointment: createdAppointment.toObject({ getters: true })
    });
};

exports.addPescription = async (req, res, next) => {
    if (req.userData.type === "patient") {
        console.log("Not patient");
        return next(new HttpError('You are not authorized to perform this action', 401));
    }
    const { id } = req.params;
    const { pescription } = req.body;
    let appointment;
    try {
        appointment = await Appointment.findById(id);
    } catch (error) {
        console.log(error.message);
        return next(new HttpError('Something went wrong, could not add Pescription', 500));
    }
    if (req.userData.id!==appointment.doctorId.toString()) {
        return next(new HttpError('Something went wrong, could not add Pescription', 500));
    }
    appointment.prescription = pescription;
    try {
        await appointment.save();
    } catch (error) {
        console.log(error.message);
        return next(new HttpError('Something went wrong, could not add Pescription', 500));
    }
    res.status(200).json({ appointment: appointment.toObject({ getters: true }) });
};

exports.cancelAppointment = async (req, res, next) => {
    const { id } = req.params;
    let appointment;
    try {
        appointment = await Appointment.findById(id).populate('doctorId')
        .populate('patientId');
    } catch (error) {
        return next(new HttpError('Something went wrong, could not delete appointment', 500));
    }
    if(!appointment){
        return next(new HttpError('Could not find appointment for this id', 404));
    }
    const doctor = appointment.doctorId.id;
    const patient = appointment.patientId.id;
    const user = req.userData.id;
    if(user !== doctor && user !== patient){
        return next(new HttpError('You are not authorized to perform this action', 401));
    }
    try {
        const session = await mongoose.startSession();
        session.startTransaction();
        await appointment.remove({ session: session });
        appointment.doctorId.appointments.pull(appointment);
        await appointment.doctorId.save({ session: session });
        appointment.patientId.appointments.pull(appointment);
        await appointment.patientId.save({ session: session });
        await session.commitTransaction();
    } catch (error) {
        console.log(error.message);
        return next(new HttpError('Something went wrong, could not create appointment', 500));
    }
    res.status(200).json({ message: 'Appointment deleted' });
}