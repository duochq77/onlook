const compute = require('@google-cloud/compute');
const client = new compute.DisksClient();

exports.autoDeleteUnusedDisks = async (req, res) => {
    const projectId = process.env.PROJECT_ID;
    const zones = ['asia-southeast1-a', 'asia-southeast1-b', 'asia-southeast1-c'];

    let deleted = [];

    for (const zone of zones) {
        const [disks] = await client.list({
            project: projectId,
            zone,
        });

        for (const disk of disks) {
            if (!disk.users || disk.users.length === 0) {
                console.log(`🗑 Deleting unused disk: ${disk.name} in ${zone}`);
                await client.delete({
                    project: projectId,
                    zone,
                    disk: disk.name,
                });
                deleted.push(`${zone}/${disk.name}`);
            }
        }
    }

    res.status(200).send(`✅ Deleted: ${deleted.length} disks.\n${deleted.join('\n')}`);
};
