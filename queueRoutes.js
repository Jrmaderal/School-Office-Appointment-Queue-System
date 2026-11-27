
const express = require('express');
const db = require('./database');
const { randomUUID } = require('crypto');

module.exports = function (io) {

    const router = express.Router();

    const offices = [
        'registrar',
        'cashier',
        'guidance',
        'admission'
    ];

    router.get('/', (req, res) => {

        db.all('SELECT * FROM tickets ORDER BY createdAt ASC',
            (err, rows) => {

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: err.message
                    });
                }

                res.json(rows);
            }
        );
    });

    router.post('/', (req, res) => {

        const {
            studentId,
            studentName,
            office,
            service
        } = req.body;

        if (![studentId, studentName, office, service]
            .every(value => typeof value === 'string' && value.trim())) {
            return res.status(400).json({
                success: false,
                message: 'Please complete all fields.'
            });
        }

        if (!offices.includes(office)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid office.'
            });
        }

        const id = randomUUID();
        const createdAt = new Date().toISOString();

        const sql = `
            INSERT INTO tickets (
                id, number, studentId, studentName,
                office, service, status, createdAt,
                estimatedWait
            )
            SELECT
                ?,
                printf('%03d', COALESCE(MAX(CAST(number AS INTEGER)), 0) + 1),
                ?, ?, ?, ?, 'waiting', ?,
                (COUNT(CASE WHEN status = 'waiting' THEN 1 END) + 1) * 5
            FROM tickets
            WHERE office = ?
            HAVING NOT EXISTS (
                SELECT 1 FROM tickets
                WHERE studentId = ?
                AND status IN ('waiting', 'serving')
            )
        `;

        db.run(sql, [
            id,
            studentId,
            studentName,
            office,
            service,
            createdAt,
            office,
            studentId
        ], function (err) {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            if (this.changes === 0) {
                return res.status(409).json({
                    success: false,
                    message: 'You already have an active ticket.'
                });
            }

            db.get(
                'SELECT * FROM tickets WHERE id = ?',
                [id],
                (err, ticket) => {

                    if (err) {
                        return res.status(500).json({
                            success: false,
                            message: err.message
                        });
                    }

                    io.emit('queueUpdated');

                    res.status(201).json({
                        success: true,
                        ticket: ticket,
                        position: ticket.estimatedWait / 5,
                        estimatedWait: ticket.estimatedWait
                    });
                }
            );
        });
    });

router.patch('/:id/status', (req, res) => {

    const id = req.params.id;
    const { status } = req.body;

    const allowedStatuses = [
        'serving',
        'served',
        'skipped',
        'cancelled'
    ];

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid status.'
        });
    }

    
    const sql = `
        UPDATE tickets
        SET status = ?
        WHERE id = ?
        AND (
            (
                ? = 'serving'
                AND status = 'waiting'
                AND NOT EXISTS (
                    SELECT 1 FROM tickets AS active
                    WHERE active.office = tickets.office
                    AND active.status = 'serving'
                )
            )
            OR (? = 'served' AND status = 'serving')
            OR (? = 'skipped'
                AND status IN ('waiting', 'serving'))
            OR (? = 'cancelled'
                AND status = 'waiting')
            )
    `;


    db.run(sql, [
    status, id, status, status, status, status
    ], function (err) {

        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Database error.'
            });
        }

        if (this.changes === 0) {
            return res.status(409).json({
                success: false,
                message: 'Ticket unavailable or office is busy.'
            });
        }

        db.get(
            'SELECT * FROM tickets WHERE id = ?',
            [id],
            (err, ticket) => {

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: 'Database error.'
                    });
                }

                io.emit('queueUpdated');

                res.json({
                    success: true,
                    ticket: ticket
                });
            }
        );
    });
});

    router.patch('/:id/transfer', (req, res) => {

        const id = req.params.id;
        const { targetOffice } = req.body;

        const allowedOffices = [
            'registrar',
            'finance',
            'guidance',
            'admission'
        ];

        if (!allowedOffices.includes(targetOffice)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid destination office.'
            });
        }

        const sql = `
            UPDATE tickets
            SET office = ?,
                status = 'waiting',
                number = (
                    SELECT printf('%03d',
                        COALESCE(MAX(CAST(number AS INTEGER)), 0) + 1
                    )
                    FROM tickets
                    WHERE office = ?
                ),
                createdAt = ?
            WHERE id = ?
            AND office != ?
            AND status IN ('waiting', 'serving')
        `;

        db.run(sql, [
            targetOffice,
            targetOffice,
            new Date().toISOString(),
            id,
            targetOffice
        ], function (err) {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: 'Database error.'
                });
            }

            if (this.changes === 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Ticket cannot be transferred.'
                });
            }

            db.get(
                'SELECT * FROM tickets WHERE id = ?',
                [id],
                (err, ticket) => {

                    if (err) {
                        return res.status(500).json({
                            success: false,
                            message: 'Database error.'
                        });
                    }

                    io.emit('queueUpdated');

                    res.json({
                        success: true,
                        ticket: ticket
                    });
                }
            );
        });
    });


    return router;
};
